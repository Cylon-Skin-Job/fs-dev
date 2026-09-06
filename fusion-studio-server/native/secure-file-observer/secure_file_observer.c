#define _DARWIN_C_SOURCE 1
#include <node_api.h>

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <math.h>
#include <stdint.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#ifndef O_CLOEXEC
#define O_CLOEXEC 0
#endif
#ifndef O_NOFOLLOW
#define O_NOFOLLOW 0
#endif
#ifndef AT_SYMLINK_NOFOLLOW
#define AT_SYMLINK_NOFOLLOW 0
#endif

#define MAX_RELATIVE_BYTES 4096
#define MAX_COMPONENTS 2048

typedef enum {
  RESULT_BYTES,
  RESULT_ABSENT,
  RESULT_SKIPPED,
  RESULT_FAILED,
  RESULT_RETRY,
  RESULT_RETRY_WORKSPACE
} result_kind;

typedef struct {
  dev_t device;
  ino_t inode;
  mode_t type;
} descriptor_identity;

typedef struct {
  result_kind kind;
  char reason[48];
  unsigned char *bytes;
  size_t byte_length;
  struct stat stat_value;
  int missing_ordinal;
  descriptor_identity authority_chain[MAX_COMPONENTS];
  int authority_chain_length;
} inspect_result;

typedef struct {
  napi_env env;
  napi_async_work work;
  napi_deferred deferred;
  char *root_path;
  char *relative_path;
  char *expected_dev;
  char *expected_ino;
  size_t byte_limit;
  uint64_t deadline_ns;
  _Atomic int32_t *cancelled;
  napi_ref cancellation_ref;
  _Atomic int32_t *test_parent_barrier;
  napi_ref test_parent_barrier_ref;
  inspect_result result;
  char validation_error[96];
} observer_work;

static int should_stop(observer_work *work);

static int checked_open(observer_work *work, const char *path, int flags) {
  for (;;) {
    if (should_stop(work)) { errno = ETIMEDOUT; return -1; }
    int result = open(path, flags);
    if (result >= 0 || errno != EINTR) return result;
  }
}

static int checked_openat(observer_work *work, int fd, const char *path, int flags) {
  for (;;) {
    if (should_stop(work)) { errno = ETIMEDOUT; return -1; }
    int result = openat(fd, path, flags);
    if (result >= 0 || errno != EINTR) return result;
  }
}

static int checked_fstat(observer_work *work, int fd, struct stat *value) {
  for (;;) {
    if (should_stop(work)) { errno = ETIMEDOUT; return -1; }
    int result = fstat(fd, value);
    if (result == 0 || errno != EINTR) return result;
  }
}

static int checked_fstatat(observer_work *work, int fd, const char *path, struct stat *value, int flags) {
  for (;;) {
    if (should_stop(work)) { errno = ETIMEDOUT; return -1; }
    int result = fstatat(fd, path, value, flags);
    if (result == 0 || errno != EINTR) return result;
  }
}

static ssize_t checked_read(observer_work *work, int fd, void *buffer, size_t length) {
  for (;;) {
    if (should_stop(work)) { errno = ETIMEDOUT; return -1; }
    ssize_t result = read(fd, buffer, length);
    if (result >= 0 || errno != EINTR) return result;
  }
}

static uint64_t monotonic_ns(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) return UINT64_MAX;
  return ((uint64_t)value.tv_sec * 1000000000ULL) + (uint64_t)value.tv_nsec;
}

static int should_stop(observer_work *work) {
  return (work->cancelled != NULL && atomic_load(work->cancelled) != 0)
    || monotonic_ns() >= work->deadline_ns;
}

static int wait_test_parent_barrier(observer_work *work) {
  if (work->test_parent_barrier == NULL) return 1;
  int32_t stage = atomic_fetch_add(&work->test_parent_barrier[0], 1) + 1;
  while (atomic_load(&work->test_parent_barrier[1]) < stage) {
    if (should_stop(work)) return 0;
    struct timespec pause = { .tv_sec = 0, .tv_nsec = 1000000L };
    while (nanosleep(&pause, &pause) != 0 && errno == EINTR) {
      if (should_stop(work)) return 0;
    }
  }
  return 1;
}

static void set_result(inspect_result *result, result_kind kind, const char *reason) {
  result->kind = kind;
  result->reason[0] = '\0';
  if (reason != NULL) snprintf(result->reason, sizeof(result->reason), "%s", reason);
}

static int same_identity(const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev
    && left->st_ino == right->st_ino
    && (left->st_mode & S_IFMT) == (right->st_mode & S_IFMT);
}

static int same_regular_identity(const struct stat *left, const struct stat *right) {
  return same_identity(left, right) && left->st_size == right->st_size;
}

static int same_regular_stability(const struct stat *left, const struct stat *right) {
  return same_regular_identity(left, right)
    && left->st_mtimespec.tv_sec == right->st_mtimespec.tv_sec
    && left->st_mtimespec.tv_nsec == right->st_mtimespec.tv_nsec
    && left->st_ctimespec.tv_sec == right->st_ctimespec.tv_sec
    && left->st_ctimespec.tv_nsec == right->st_ctimespec.tv_nsec;
}

static int parse_u64(const char *value, uint64_t *output) {
  if (value == NULL || *value == '\0') return 0;
  uint64_t result = 0;
  for (const unsigned char *cursor = (const unsigned char *)value; *cursor != '\0'; cursor += 1) {
    if (*cursor < '0' || *cursor > '9') return 0;
    uint64_t digit = (uint64_t)(*cursor - '0');
    if (result > (UINT64_MAX - digit) / 10ULL) return 0;
    result = result * 10ULL + digit;
  }
  *output = result;
  return 1;
}

static int expected_identity_matches(observer_work *work, const struct stat *value) {
  if (work->expected_dev == NULL && work->expected_ino == NULL) return 1;
  if (work->expected_dev == NULL || work->expected_ino == NULL) return 0;
  uint64_t expected_dev = 0;
  uint64_t expected_ino = 0;
  if (!parse_u64(work->expected_dev, &expected_dev) || !parse_u64(work->expected_ino, &expected_ino)) return 0;
  return (uint64_t)value->st_dev == expected_dev && (uint64_t)value->st_ino == expected_ino;
}

static int validate_relative(const char *value) {
  size_t length = strlen(value);
  if (length == 0 || length > MAX_RELATIVE_BYTES || value[0] == '/' || value[length - 1] == '/') return 0;
  const char *start = value;
  for (const char *cursor = value;; cursor += 1) {
    if (*cursor == '\\') return 0;
    if (*cursor == '/' || *cursor == '\0') {
      size_t component_length = (size_t)(cursor - start);
      if (component_length == 0
        || (component_length == 1 && start[0] == '.')
        || (component_length == 2 && start[0] == '.' && start[1] == '.')) return 0;
      if (*cursor == '\0') break;
      start = cursor + 1;
    }
  }
  return 1;
}

static int split_components(char *relative, char **parts, int *count) {
  int used = 0;
  char *start = relative;
  for (char *cursor = relative;; cursor += 1) {
    if (*cursor == '/' || *cursor == '\0') {
      if (used >= MAX_COMPONENTS) return 0;
      parts[used++] = start;
      if (*cursor == '\0') break;
      *cursor = '\0';
      start = cursor + 1;
    }
  }
  *count = used;
  return 1;
}

static void close_descriptors(int *fds, int count) {
  for (int index = count - 1; index >= 0; index -= 1) {
    if (fds[index] >= 0) close(fds[index]);
  }
}

static void secure_zero_free(void *data, size_t length) {
  if (data == NULL) return;
  volatile unsigned char *bytes = (volatile unsigned char *)data;
  for (size_t index = 0; index < length; index += 1) bytes[index] = 0;
  free(data);
}

static inspect_result inspect_once(observer_work *work) {
  inspect_result result;
  memset(&result, 0, sizeof(result));
  set_result(&result, RESULT_FAILED, "unreadable");
  int fds[MAX_COMPONENTS];
  struct stat directory_stats[MAX_COMPONENTS];
  int fd_count = 0;
  for (int index = 0; index < MAX_COMPONENTS; index += 1) fds[index] = -1;

  if (O_CLOEXEC == 0 || O_NOFOLLOW == 0 || AT_SYMLINK_NOFOLLOW == 0) {
    set_result(&result, RESULT_FAILED, "secure_open_unavailable");
    return result;
  }

  if (should_stop(work)) {
    set_result(&result, RESULT_FAILED, "observation_timeout");
    return result;
  }
  int root_flags = O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC;
  int root_fd = checked_open(work, work->root_path, root_flags);
  if (root_fd < 0) {
    set_result(&result,
      errno == ETIMEDOUT ? RESULT_FAILED : RESULT_RETRY_WORKSPACE,
      errno == ETIMEDOUT ? "observation_timeout" : "workspace_unavailable");
    return result;
  }
  fds[fd_count] = root_fd;
  if (checked_fstat(work, root_fd, &directory_stats[fd_count]) != 0
    || !S_ISDIR(directory_stats[fd_count].st_mode)
    || !expected_identity_matches(work, &directory_stats[fd_count])) {
    close_descriptors(fds, fd_count + 1);
    set_result(&result,
      errno == ETIMEDOUT ? RESULT_FAILED : RESULT_RETRY_WORKSPACE,
      errno == ETIMEDOUT ? "observation_timeout" : "workspace_unavailable");
    return result;
  }
  fd_count += 1;

  char *relative_copy = strdup(work->relative_path);
  if (relative_copy == NULL) {
    close_descriptors(fds, fd_count);
    return result;
  }
  char *parts[MAX_COMPONENTS];
  int part_count = 0;
  if (!split_components(relative_copy, parts, &part_count) || part_count < 1) {
    free(relative_copy);
    close_descriptors(fds, fd_count);
    set_result(&result, RESULT_SKIPPED, "invalid_path");
    return result;
  }

  for (int index = 0; index < part_count - 1; index += 1) {
    if (should_stop(work)) {
      set_result(&result, RESULT_FAILED, "observation_timeout");
      goto cleanup;
    }
    int next_fd = checked_openat(work, fds[fd_count - 1], parts[index], root_flags);
    if (next_fd < 0) {
      int code = errno;
      result.missing_ordinal = index;
      if (code == ENOENT) set_result(&result, RESULT_ABSENT, NULL);
      else if (code == ELOOP || code == ENOTDIR) {
        struct stat component_stat;
        if (checked_fstatat(work, fds[fd_count - 1], parts[index], &component_stat, AT_SYMLINK_NOFOLLOW) == 0) {
          result.stat_value = component_stat;
          set_result(&result, RESULT_SKIPPED, "invalid_path");
        } else {
          set_result(&result, RESULT_RETRY, NULL);
        }
      } else set_result(&result, RESULT_FAILED, "unreadable");
      goto cleanup;
    }
    fds[fd_count] = next_fd;
    if (checked_fstat(work, next_fd, &directory_stats[fd_count]) != 0 || !S_ISDIR(directory_stats[fd_count].st_mode)) {
      set_result(&result, RESULT_RETRY, NULL);
      fd_count += 1;
      goto cleanup;
    }
    fd_count += 1;
  }

  const char *final_name = parts[part_count - 1];
  if (!wait_test_parent_barrier(work)) {
    set_result(&result, RESULT_FAILED, "observation_timeout");
    goto cleanup;
  }
  struct stat lookup_stat;
  if (checked_fstatat(work, fds[fd_count - 1], final_name, &lookup_stat, AT_SYMLINK_NOFOLLOW) != 0) {
    int code = errno;
    if (code == ENOENT) {
      result.missing_ordinal = part_count - 1;
      set_result(&result, RESULT_ABSENT, NULL);
    } else {
      set_result(&result, RESULT_FAILED, "unreadable");
    }
    goto revalidate;
  }
  result.stat_value = lookup_stat;
  if (S_ISLNK(lookup_stat.st_mode)) {
    set_result(&result, RESULT_SKIPPED, "final_symlink");
    goto revalidate;
  }
  if (!S_ISREG(lookup_stat.st_mode)) {
    set_result(&result, RESULT_SKIPPED, "not_regular_file");
    goto revalidate;
  }
  if (lookup_stat.st_size < 0 || (uint64_t)lookup_stat.st_size > (uint64_t)work->byte_limit) {
    set_result(&result, RESULT_SKIPPED, "too_large");
    goto revalidate;
  }
  int file_fd = checked_openat(work, fds[fd_count - 1], final_name, O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  if (file_fd < 0) {
    int code = errno;
    if (code == EINVAL || code == ENOTSUP) set_result(&result, RESULT_FAILED, "secure_open_unavailable");
    else if (code == ENOENT || code == ELOOP || code == ENOTDIR) set_result(&result, RESULT_RETRY, NULL);
    else set_result(&result, RESULT_FAILED, "unreadable");
    goto cleanup;
  }
  struct stat opened_stat;
  if (checked_fstat(work, file_fd, &opened_stat) != 0 || !S_ISREG(opened_stat.st_mode)
    || !same_regular_identity(&lookup_stat, &opened_stat)) {
    close(file_fd);
    set_result(&result, RESULT_RETRY, NULL);
    goto cleanup;
  }
  size_t capacity = (size_t)opened_stat.st_size + 1;
  if (capacity > work->byte_limit + 1) capacity = work->byte_limit + 1;
  if (capacity == 0) capacity = 1;
  unsigned char *bytes = malloc(capacity);
  if (bytes == NULL) {
    close(file_fd);
    goto cleanup;
  }
  size_t used = 0;
  while (used < capacity) {
    if (should_stop(work)) {
      secure_zero_free(bytes, used);
      close(file_fd);
      set_result(&result, RESULT_FAILED, "observation_timeout");
      goto cleanup;
    }
    ssize_t count = checked_read(work, file_fd, bytes + used, capacity - used);
    if (count < 0) {
      secure_zero_free(bytes, used);
      close(file_fd);
      set_result(&result, RESULT_FAILED, "unreadable");
      goto cleanup;
    }
    if (count == 0) break;
    used += (size_t)count;
  }
  struct stat final_handle_stat;
  struct stat final_lookup_stat;
  int stable = checked_fstat(work, file_fd, &final_handle_stat) == 0
    && checked_fstatat(work, fds[fd_count - 1], final_name, &final_lookup_stat, AT_SYMLINK_NOFOLLOW) == 0
    && same_regular_stability(&opened_stat, &final_handle_stat)
    && same_regular_identity(&final_handle_stat, &final_lookup_stat);
  close(file_fd);
  if (used > work->byte_limit) {
    secure_zero_free(bytes, used);
    set_result(&result, RESULT_SKIPPED, "too_large");
    goto revalidate;
  }
  if (!stable) {
    secure_zero_free(bytes, used);
    set_result(&result, RESULT_RETRY, NULL);
    goto cleanup;
  }
  result.bytes = bytes;
  result.byte_length = used;
  result.stat_value = final_handle_stat;
  set_result(&result, RESULT_BYTES, NULL);

revalidate:
  for (int index = 0; index < fd_count; index += 1) {
    struct stat current;
    if (checked_fstat(work, fds[index], &current) != 0 || !same_identity(&directory_stats[index], &current)) {
      if (result.bytes != NULL) {
        secure_zero_free(result.bytes, result.byte_length);
        result.bytes = NULL;
      }
      set_result(&result, RESULT_RETRY, NULL);
      break;
    }
  }

cleanup:
  if (result.kind == RESULT_ABSENT || result.kind == RESULT_SKIPPED) {
    result.authority_chain_length = fd_count;
    for (int index = 0; index < fd_count; index += 1) {
      result.authority_chain[index].device = directory_stats[index].st_dev;
      result.authority_chain[index].inode = directory_stats[index].st_ino;
      result.authority_chain[index].type = directory_stats[index].st_mode & S_IFMT;
    }
  }
  free(relative_copy);
  close_descriptors(fds, fd_count);
  return result;
}

static int stable_terminal(const inspect_result *left, const inspect_result *right) {
  if (left->kind != right->kind || strcmp(left->reason, right->reason) != 0) return 0;
  if (left->authority_chain_length != right->authority_chain_length) return 0;
  for (int index = 0; index < left->authority_chain_length; index += 1) {
    if (left->authority_chain[index].device != right->authority_chain[index].device
      || left->authority_chain[index].inode != right->authority_chain[index].inode
      || left->authority_chain[index].type != right->authority_chain[index].type) return 0;
  }
  if (left->kind == RESULT_ABSENT) return left->missing_ordinal == right->missing_ordinal;
  if (left->kind == RESULT_SKIPPED) return same_identity(&left->stat_value, &right->stat_value);
  return 1;
}

static void execute_observation(napi_env env, void *data) {
  (void)env;
  observer_work *work = data;
  inspect_result first = inspect_once(work);
  if (should_stop(work)) {
    if (first.bytes != NULL) secure_zero_free(first.bytes, first.byte_length);
    set_result(&work->result, RESULT_FAILED, "observation_timeout");
    return;
  }
  if (first.kind == RESULT_BYTES || first.kind == RESULT_FAILED) {
    work->result = first;
    return;
  }
  // The private smoke barrier normally gates each successfully pinned parent.
  // Also expose the boundary between a transient root failure and its sole
  // retry so the retry-success ownership path can be exercised deterministically.
  if (first.kind == RESULT_RETRY_WORKSPACE && !wait_test_parent_barrier(work)) {
    set_result(&work->result, RESULT_FAILED, "observation_timeout");
    return;
  }
  // Repeated terminal results are authoritative only when independently
  // reached through the same root/parent descriptor identities. The private
  // smoke barrier exposes the complete-sequence boundary for race fixtures.
  if ((first.kind == RESULT_ABSENT || first.kind == RESULT_SKIPPED)
    && !wait_test_parent_barrier(work)) {
    set_result(&work->result, RESULT_FAILED, "observation_timeout");
    return;
  }
  inspect_result second = inspect_once(work);
  if (first.kind == RESULT_RETRY_WORKSPACE) {
    if (should_stop(work) || (second.kind == RESULT_FAILED
      && strcmp(second.reason, "observation_timeout") == 0)) {
      if (second.bytes != NULL) secure_zero_free(second.bytes, second.byte_length);
      set_result(&work->result, RESULT_FAILED, "observation_timeout");
      return;
    }
    if (second.kind == RESULT_RETRY_WORKSPACE) {
      if (second.bytes != NULL) secure_zero_free(second.bytes, second.byte_length);
      set_result(&work->result, RESULT_FAILED, "workspace_unavailable");
    } else if (second.kind == RESULT_RETRY
      || second.kind == RESULT_ABSENT
      || second.kind == RESULT_SKIPPED) {
      // Absence, symlink, and non-regular outcomes require two independently
      // verified complete descriptor sequences. The first sequence never
      // established root authority, so the sole retry cannot by itself make
      // one of those terminal claims.
      if (second.bytes != NULL) secure_zero_free(second.bytes, second.byte_length);
      set_result(&work->result, RESULT_FAILED, "unstable_during_observation");
    } else {
      // Ownership of a successful retry buffer transfers to work->result and,
      // ultimately, the external Node Buffer finalizer.
      work->result = second;
    }
    return;
  }
  if (first.kind == RESULT_RETRY) {
    if (second.kind == RESULT_BYTES || second.kind == RESULT_FAILED) work->result = second;
    else {
      if (second.bytes != NULL) secure_zero_free(second.bytes, second.byte_length);
      set_result(&work->result, RESULT_FAILED, "unstable_during_observation");
    }
    return;
  }
  if (!stable_terminal(&first, &second)) {
    if (second.bytes != NULL) secure_zero_free(second.bytes, second.byte_length);
    set_result(&work->result, RESULT_FAILED, "unstable_during_observation");
    return;
  }
  work->result = second;
}

static napi_value string_value(napi_env env, const char *text) {
  napi_value value;
  napi_create_string_utf8(env, text, NAPI_AUTO_LENGTH, &value);
  return value;
}

static void finalize_external_bytes(napi_env env, void *data, void *hint) {
  (void)env;
  secure_zero_free(data, (size_t)(uintptr_t)hint);
}

static napi_value monotonic_now_value(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value value;
  napi_create_bigint_uint64(env, monotonic_ns(), &value);
  return value;
}

static void set_named_string(napi_env env, napi_value object, const char *name, const char *value) {
  napi_set_named_property(env, object, name, string_value(env, value));
}

static void set_named_i64_string(napi_env env, napi_value object, const char *name, uint64_t value) {
  char text[32];
  snprintf(text, sizeof(text), "%llu", (unsigned long long)value);
  set_named_string(env, object, name, text);
}

static void complete_observation(napi_env env, napi_status status, void *data) {
  observer_work *work = data;
  napi_value result;
  napi_create_object(env, &result);
  if (status != napi_ok) {
    set_named_string(env, result, "status", "failed");
    set_named_string(env, result, "reason", "secure_open_unavailable");
  } else if (work->result.kind == RESULT_BYTES) {
    set_named_string(env, result, "status", "bytes");
    napi_value bytes;
    napi_status buffer_status = napi_create_external_buffer(
      env,
      work->result.byte_length,
      work->result.bytes,
      finalize_external_bytes,
      (void *)(uintptr_t)work->result.byte_length,
      &bytes
    );
    if (buffer_status != napi_ok) {
      secure_zero_free(work->result.bytes, work->result.byte_length);
      work->result.bytes = NULL;
      set_named_string(env, result, "status", "failed");
      set_named_string(env, result, "reason", "secure_open_unavailable");
    } else {
      work->result.bytes = NULL;
      napi_set_named_property(env, result, "bytes", bytes);
      napi_value fingerprint;
      napi_create_object(env, &fingerprint);
      set_named_i64_string(env, fingerprint, "dev", (uint64_t)work->result.stat_value.st_dev);
      set_named_i64_string(env, fingerprint, "ino", (uint64_t)work->result.stat_value.st_ino);
      napi_value size;
      napi_create_double(env, (double)work->result.stat_value.st_size, &size);
      napi_set_named_property(env, fingerprint, "size", size);
      napi_value birthtime;
      double birthtime_ms = (double)(work->result.stat_value.st_birthtimespec.tv_sec * 1000LL
        + work->result.stat_value.st_birthtimespec.tv_nsec / 1000000L);
      napi_create_double(env, birthtime_ms, &birthtime);
      napi_set_named_property(env, fingerprint, "birthtimeMs", birthtime);
      napi_set_named_property(env, result, "fingerprint", fingerprint);
    }
  } else if (work->result.kind == RESULT_ABSENT) {
    set_named_string(env, result, "status", "absent");
  } else {
    set_named_string(env, result, "status", work->result.kind == RESULT_SKIPPED ? "skipped" : "failed");
    set_named_string(env, result, "reason",
      work->result.reason[0] == '\0' ? "unreadable" : work->result.reason);
  }
  napi_resolve_deferred(env, work->deferred, result);
  if (work->result.bytes != NULL) {
    secure_zero_free(work->result.bytes, work->result.byte_length);
  }
  free(work->root_path);
  free(work->relative_path);
  free(work->expected_dev);
  free(work->expected_ino);
  if (work->cancellation_ref != NULL) napi_delete_reference(env, work->cancellation_ref);
  if (work->test_parent_barrier_ref != NULL) napi_delete_reference(env, work->test_parent_barrier_ref);
  napi_delete_async_work(env, work->work);
  free(work);
}

static char *get_optional_string(
  napi_env env,
  napi_value object,
  const char *name,
  int required,
  size_t *output_length,
  int *valid
) {
  napi_value value;
  bool present = false;
  *valid = 0;
  if (napi_has_named_property(env, object, name, &present) != napi_ok) return NULL;
  if (!present) { *valid = !required; return NULL; }
  if (napi_get_named_property(env, object, name, &value) != napi_ok) return NULL;
  napi_valuetype type;
  if (napi_typeof(env, value, &type) != napi_ok) return NULL;
  if (type == napi_null || type == napi_undefined) { *valid = !required; return NULL; }
  if (type != napi_string) return NULL;
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok) return NULL;
  char *text = malloc(length + 1);
  if (text == NULL) return NULL;
  if (napi_get_value_string_utf8(env, value, text, length + 1, &length) != napi_ok) {
    free(text);
    return NULL;
  }
  if (output_length != NULL) *output_length = length;
  *valid = 1;
  return text;
}

static napi_value observe(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, NULL, NULL);
  napi_valuetype type;
  if (argc != 1 || napi_typeof(env, argv[0], &type) != napi_ok || type != napi_object) {
    napi_throw_type_error(env, NULL, "secure observer input must be an object");
    return NULL;
  }
  observer_work *work = calloc(1, sizeof(*work));
  if (work == NULL) {
    napi_throw_error(env, NULL, "secure observer allocation failed");
    return NULL;
  }
  work->env = env;
  size_t root_length = 0;
  size_t relative_length = 0;
  size_t expected_dev_length = 0;
  size_t expected_ino_length = 0;
  size_t deadline_length = 0;
  int root_valid = 0;
  int relative_valid = 0;
  int expected_dev_valid = 0;
  int expected_ino_valid = 0;
  int deadline_valid = 0;
  work->root_path = get_optional_string(env, argv[0], "rootPath", 1, &root_length, &root_valid);
  work->relative_path = get_optional_string(env, argv[0], "relativePath", 1, &relative_length, &relative_valid);
  work->expected_dev = get_optional_string(env, argv[0], "expectedRootDevice", 0, &expected_dev_length, &expected_dev_valid);
  work->expected_ino = get_optional_string(env, argv[0], "expectedRootInode", 0, &expected_ino_length, &expected_ino_valid);
  char *deadline = get_optional_string(env, argv[0], "deadlineNs", 1, &deadline_length, &deadline_valid);
  napi_value byte_limit_value;
  double byte_limit = 0;
  bool has_byte_limit = false;
  int byte_limit_valid = napi_has_named_property(env, argv[0], "byteLimit", &has_byte_limit) == napi_ok
    && has_byte_limit;
  if (has_byte_limit) {
    byte_limit_valid = napi_get_named_property(env, argv[0], "byteLimit", &byte_limit_value) == napi_ok
      && napi_get_value_double(env, byte_limit_value, &byte_limit) == napi_ok
      && isfinite(byte_limit);
  }
  uint64_t expected_dev = 0;
  uint64_t expected_ino = 0;
  if (!root_valid || !relative_valid || !expected_dev_valid || !expected_ino_valid || !deadline_valid
    || !byte_limit_valid || work->root_path == NULL || work->relative_path == NULL || deadline == NULL
    || work->root_path[0] != '/' || strlen(work->root_path) != root_length
    || strlen(work->relative_path) != relative_length
    || !validate_relative(work->relative_path)
    || byte_limit < 0 || byte_limit > 10485760 || (double)(size_t)byte_limit != byte_limit
    || strlen(deadline) != deadline_length || !parse_u64(deadline, &work->deadline_ns)
    || ((work->expected_dev == NULL) != (work->expected_ino == NULL))
    || (work->expected_dev != NULL && (strlen(work->expected_dev) != expected_dev_length
      || strlen(work->expected_ino) != expected_ino_length
      || !parse_u64(work->expected_dev, &expected_dev)
      || !parse_u64(work->expected_ino, &expected_ino)))) {
    free(deadline);
    free(work->root_path); free(work->relative_path); free(work->expected_dev); free(work->expected_ino); free(work);
    napi_throw_type_error(env, NULL, "secure observer input is invalid");
    return NULL;
  }
  free(deadline);
  work->byte_limit = (size_t)byte_limit;

  bool has_cancel = false;
  napi_has_named_property(env, argv[0], "cancelView", &has_cancel);
  if (has_cancel) {
    napi_value cancel_value;
    napi_get_named_property(env, argv[0], "cancelView", &cancel_value);
    napi_valuetype cancel_type;
    napi_typeof(env, cancel_value, &cancel_type);
    napi_typedarray_type array_type;
    size_t length = 0;
    void *data = NULL;
    napi_value array_buffer;
    size_t offset = 0;
    if ((cancel_type == napi_null || cancel_type == napi_undefined)) {
      // The JavaScript wrapper uses null for an absent cooperative handle.
    } else if (napi_get_typedarray_info(env, cancel_value, &array_type, &length, &data, &array_buffer, &offset) == napi_ok
      && array_type == napi_int32_array && length >= 1) {
      work->cancelled = (_Atomic int32_t *)data;
      napi_create_reference(env, cancel_value, 1, &work->cancellation_ref);
    } else {
      free(work->root_path); free(work->relative_path); free(work->expected_dev); free(work->expected_ino); free(work);
      napi_throw_type_error(env, NULL, "secure observer cancellation handle is invalid");
      return NULL;
    }
  }

  bool has_test_parent_barrier = false;
  napi_has_named_property(env, argv[0], "testParentBarrier", &has_test_parent_barrier);
  if (has_test_parent_barrier) {
    napi_value barrier_value;
    napi_get_named_property(env, argv[0], "testParentBarrier", &barrier_value);
    napi_typedarray_type array_type;
    size_t length = 0;
    void *data = NULL;
    napi_value array_buffer;
    size_t offset = 0;
    if (napi_get_typedarray_info(env, barrier_value, &array_type, &length, &data, &array_buffer, &offset) == napi_ok
      && array_type == napi_int32_array && length >= 2) {
      work->test_parent_barrier = (_Atomic int32_t *)data;
      napi_create_reference(env, barrier_value, 1, &work->test_parent_barrier_ref);
    }
  }

  napi_value promise;
  napi_create_promise(env, &work->deferred, &promise);
  napi_value name = string_value(env, "fusion-secure-file-observer");
  napi_create_async_work(env, NULL, name, execute_observation, complete_observation, work, &work->work);
  napi_queue_async_work(env, work->work);
  return promise;
}

static napi_value initialize(napi_env env, napi_value exports) {
  napi_property_descriptor descriptors[] = {
    { "observe", NULL, observe, NULL, NULL, NULL, napi_default, NULL },
    { "monotonicNowNs", NULL, monotonic_now_value, NULL, NULL, NULL, napi_default, NULL }
  };
  napi_define_properties(env, exports, 2, descriptors);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
