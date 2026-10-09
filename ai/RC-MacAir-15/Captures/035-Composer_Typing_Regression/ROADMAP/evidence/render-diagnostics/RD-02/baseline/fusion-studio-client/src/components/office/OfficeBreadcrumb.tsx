/**
 * @module OfficeBreadcrumb
 * @role Breadcrumb title for nested Office folder paths.
 */

interface OfficeBreadcrumbProps {
  folderPath: string;
  onHomeClick: () => void;
  onFolderClick: (folderPath: string) => void;
}

function splitOfficeFolderPath(folderPath: string): string[] {
  return folderPath.split('/').filter(Boolean);
}

export function OfficeBreadcrumb({
  folderPath,
  onHomeClick,
  onFolderClick,
}: OfficeBreadcrumbProps) {
  const segments = splitOfficeFolderPath(folderPath);

  return (
    <span className="rv-office-breadcrumb" aria-label={`Office path: Home > ${segments.join(' > ')}`}>
      <button
        type="button"
        className="rv-office-breadcrumb-link"
        onClick={onHomeClick}
      >
        Home
      </button>
      {segments.map((segment, index) => {
        const path = segments.slice(0, index + 1).join('/');
        const isCurrent = index === segments.length - 1;

        return (
          <span className="rv-office-breadcrumb-part" key={path}>
            <span className="material-symbols-outlined rv-office-breadcrumb-separator" aria-hidden="true">chevron_right</span>
            {isCurrent ? (
              <span className="rv-office-breadcrumb-current">{segment}</span>
            ) : (
              <button
                type="button"
                className="rv-office-breadcrumb-link"
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
