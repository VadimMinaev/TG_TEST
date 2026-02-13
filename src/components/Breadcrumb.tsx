import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

interface BreadcrumbItem {
  label: string;
  path?: string;
  active?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm">
        {items.map((item, index) => (
          <Fragment key={index}>
            {index > 0 && (
              <ChevronRight className="flex-shrink-0 mx-1 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            )}
            {item.path && !item.active ? (
              <li>
                <Link 
                  to={item.path} 
                  className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  {item.label}
                </Link>
              </li>
            ) : (
              <li className="text-[hsl(var(--foreground))] font-medium">
                {item.label}
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}