@echo off
REM Usage: push-to-github.bat <git-remote-url>
REM Example: push-to-github.bat https://<TOKEN>@github.com/username/repo.git










necho Initializing git (if not already)...
ngit init
necho Adding files...
ngit add -A
necho Committing...
ngit commit -m "Add archive feature & UI" || echo No changes to commit.
necho Setting main branch...
ngit branch -M main
necho Adding remote %REMOTE%...
ngit remote remove origin 2>nul || echo no remote to remove
ngit remote add origin %REMOTE%
necho Pushing to origin main...
ngit push -u origin main
necho Done. If push failed, check credentials and remote URL.SET REMOTE=%1)  exit /b 1  echo Example: push-to-github.bat https://<TOKEN>@github.com/username/repo.git  echo Error: pass the remote git URL as the first argument.n@if "%1"=="" (