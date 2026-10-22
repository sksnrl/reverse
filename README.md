# MAFIA NIGHT: LIVE

방송용 온라인 마피아 게임의 첫 번째 배포형 MVP입니다.

## 포함 기능

- 방 생성 및 5자리 방 코드
- 6~12명 참가 (10~12명 권장)
- 마피아 / 경찰 / 의사 / 영매 / 시민
- 서버에서 처리하는 직업 배정, 밤 행동, 투표, 처형, 승리 판정
- BJ 진행자 콘솔 및 방송 송출 페이지
- 모바일 반응형 UI
- 새로고침 후 세션 기반 재접속 시도
- Render 배포용 `render.yaml`

## 중요: GitHub Pages만으로는 서버가 실행되지 않습니다

이 프로젝트는 다음처럼 배포합니다.

1. 이 저장소를 GitHub에 올립니다.
2. Render에서 이 저장소를 연결해 Node.js 웹 서비스를 배포합니다.
3. Render의 서비스 URL을 복사합니다.
4. GitHub Pages로 `public/` 디렉터리를 배포합니다. 가장 쉬운 방법은 `public`을 저장소 루트에 두거나 GitHub Actions workflow를 추가하는 것입니다.
5. 게임 페이지를 처음 열 때 Render 서버 URL을 입력합니다. 브라우저에 저장됩니다.

Render 무료 서비스는 유휴 시 잠들 수 있으며, 이 MVP는 게임 방 상태를 서버 메모리에 저장합니다. 따라서 서버가 재시작되면 진행 중인 게임이 사라집니다. 실제 방송에서 장시간 안정적으로 운영하기 전에 영속 저장소/복구 기능을 추가하세요.

## Render 배포

1. GitHub에 저장소를 만듭니다.
2. 프로젝트 파일을 저장소에 업로드합니다.
3. Render 대시보드에서 **New + → Blueprint**를 선택하고 저장소를 연결합니다.
4. `render.yaml`을 확인하고 배포합니다.
5. 배포 후 `https://YOUR-SERVICE.onrender.com/health`에서 `{"ok":true,...}` 응답을 확인합니다.

## GitHub Pages 배포

이 프로젝트는 `public/`이 정적 프런트엔드입니다.

### 권장: GitHub Actions로 public 폴더 배포

저장소 Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정하고, 아래 workflow를 추가합니다.

`.github/workflows/pages.yml`:

```yaml
name: Deploy static frontend to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: public
      - id: deployment
        uses: actions/deploy-pages@v4
```

## 게임 플레이

- 진행자: 메인 페이지에서 방 생성
- 플레이어: 메인 페이지에서 방 코드와 닉네임 입력
- 진행자: 참가자가 6~12명일 때 게임 시작
- 밤 행동과 투표는 서버 타이머로 자동 종료됩니다.
- 진행자 화면의 “다음 단계로” 버튼은 타이머를 기다리지 않고 다음 단계로 넘깁니다.
- 게임 종료 후 “재경기”를 누르면 로비로 돌아갑니다.

## 알려진 MVP 한계 및 다음 작업

- 방송 송출 페이지는 관전자 전용 `room:watch` 이벤트로 공개 상태만 수신합니다.
- 방 상태는 메모리에 저장되며 서버 재시작 시 초기화됩니다.
- 접속 복구는 같은 브라우저의 `sessionStorage` 기반입니다. 브라우저/기기 변경이나 세션 삭제에는 대응하지 않습니다.
- 마피아끼리의 비밀 채팅은 아직 구현하지 않았습니다. 같은 방의 음성 대화 또는 별도 방송 수단으로 협의해야 합니다.
- 영매는 탈락한 플레이어를 조사하는 역할이지만, 현재 후보 UI는 생존자 목록을 기준으로 만들어져 있어 영매의 선택 UI를 추가 보완해야 합니다.
- 공개 투표 수는 실시간 집계되며, 기본 설정에서는 투표 대상 변경을 허용합니다.
- 재접속, 타이머, 동률 처리, 직업별 승률을 실제 여러 브라우저에서 검증한 후 방송에 투입하세요.

## 개발 실행

```bash
npm install
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

