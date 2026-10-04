# f(x) 아레나 공통 작업 지침

이 저장소는 Codex CLI와 Claude Code CLI가 함께 사용하는 프로젝트다.
사용자의 현재 요청이 이 문서보다 우선한다.

## 프로젝트

- TypeScript + Vite + Canvas 2D 게임이다. 구조와 조작은 `README.md`를 참고한다.
- 밸런스는 `src/config.ts`, 함수 무기는 `src/weapons/`, 게임 로직은 `src/game/`,
  지형·물리는 `src/world/`, 화면은 `src/render/`에서 관리한다.
- 코드 변경 후 관련 검증을 수행한다. 일반적인 검증은 `npm test`와 `npm run build`다.
  입력·화면 동작을 바꾸면 필요한 경우 `npm run test:e2e`도 실행한다.
- 문서만 바꾸면 내용과 `git diff --check`를 확인한다.

## 두 CLI의 협업

- 같은 작업 폴더에서 번갈아 작업하면 파일과 Git 이력을 공유한다. 대화 이력은 공유하지 않는다.
- 시작할 때 `git status --short --branch`와 `git diff`로 기존 변경을 확인한다.
  사용자나 다른 도구의 변경을 덮어쓰거나 자신의 커밋에 임의로 포함하지 않는다.
- 같은 작업 폴더에서는 한 번에 한 도구가 파일 수정과 Git 작업을 맡는다.
- 두 도구를 동시에 작업시킬 때는 별도 Git worktree와 별도 작업 브랜치를 사용한다.
  공유 작업 폴더에서 다른 도구가 작업 중이면 브랜치를 전환하지 않는다.
- 완료 보고에는 수정 내용, 검증 결과, 브랜치, 커밋, push 여부와 남은 변경을 적는다.

## GitHub 반영

- 원격 `origin`은 `https://github.com/nxodh/project.git`이다.
  두 CLI 모두 로컬 Git과 이 Mac의 GitHub 인증을 사용해 커밋·push할 수 있다.
- 파일 저장, 로컬 커밋, GitHub push는 별도 단계다. 자동 동기화 hook은 사용하지 않는다.
- 사용자가 GitHub 반영 또는 커밋·push를 요청하면 검증부터 push까지 수행한다.
  분석만 요청한 경우에는 커밋·push하지 않는다.
- 현재 브랜치는 매번 `git branch --show-current`로 확인한다. `claude/`로 시작하는
  브랜치도 Codex가 사용할 수 있으며, 도구 이름 때문에 브랜치를 바꿀 필요는 없다.
- 커밋 전에 diff와 staged 파일을 검토하고 이번 작업의 파일·hunk만 명시적으로 stage한다.
  관련 없는 변경이 있는 상태에서 `git add .`를 사용하지 않는다.
- push 전에 `git fetch origin`으로 원격 변경을 확인한다. 원격에 새 커밋이 있으면
  작업을 보존한 채 변경을 통합하고 필요한 검증을 다시 수행한다. force push하지 않는다.
- `git push origin HEAD`로 현재 브랜치를 올린다. 새 브랜치에는
  `git push -u origin HEAD`로 추적 대상을 설정한다.
- `main` 반영을 요청받으면 작업 브랜치에서 PR을 만든다. PR 병합은 사용자가 요청한
  범위에 포함될 때 수행한다.
- 인증·네트워크·권한 제한이 있으면 실패 원인을 보고한다. CLI가 요구하는 실행 승인은
  정상 절차로 요청하고, 인증 토큰을 파일이나 로그에 기록하지 않는다.
