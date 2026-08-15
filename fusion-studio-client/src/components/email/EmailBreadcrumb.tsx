/**
 * @module EmailBreadcrumb
 * @role Breadcrumb title for nested Email folder paths.
 */

interface EmailBreadcrumbProps {
  folderPath: string;
  onHomeClick: () => void;
  onFolderClick: (folderPath: string) => void;
}

function splitEmailFolderPath(folderPath: string): string[] {
  return folderPath.split('/').filter(Boolean);
}

export function EmailBreadcrumb({
  folderPath,
  onHomeClick,
  onFolderClick,
}: EmailBreadcrumbProps) {
  const segments = splitEmailFolderPath(folderPath);

  return (
    <span className="rv-email-breadcrumb" aria-label={`Email path: Home > ${segments.join(' > ')}`}>
      <button
        type="button"
        className="rv-email-breadcrumb-link"
        onClick={onHomeClick}
      >
        Home
      </button>
      {segments.map((segment, index) => {
        const path = segments.slice(0, index + 1).join('/');
        const isCurrent = index === segments.length - 1;

        return (
          <span className="rv-email-breadcrumb-part" key={path}>
            <span className="material-symbols-outlined rv-email-breadcrumb-separator" aria-hidden="true">chevron_right</span>
            {isCurrent ? (
              <span className="rv-email-breadcrumb-current">{segment}</span>
            ) : (
              <button
                type="button"
                className="rv-email-breadcrumb-link"
                onClick={() => onFolderClick(path)}
              >
                {segment}
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}
