{
  "targets": [
    {
      "target_name": "secure_file_observer",
      "sources": ["secure_file_observer.c"],
      "cflags_c": ["-std=c11", "-Wall", "-Wextra", "-Werror"],
      "xcode_settings": {
        "OTHER_CFLAGS": ["-std=c11", "-Wall", "-Wextra", "-Werror"]
      }
    }
  ]
}
