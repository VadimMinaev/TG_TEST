/**
 * Auto-bump version to 1.0.{commit_count+1} before each commit.
 * Called from .git/hooks/pre-commit
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Current commit count (this runs BEFORE the commit is created, so +1)
const commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10) + 1;
const newVersion = `1.0.${commitCount}`;

if (pkg.version !== newVersion) {
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  // Stage the updated package.json so it's included in this commit
  execSync('git add package.json');
  console.log(`[bump-version] ${pkg.version} -> ${newVersion}`);
} else {
  console.log(`[bump-version] version already ${newVersion}`);
}
