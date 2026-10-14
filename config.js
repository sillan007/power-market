// ===================================================================
//  나눔의 자리 설정 파일  —  아래 값만 바꿔 주세요. (index.html 은 건드리지 않아도 됩니다)
// ===================================================================
window.APP_CONFIG = {

  // 1) Firebase 설정값: Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱 → SDK 설정 및 구성
  //    (지금 쓰고 계신 index.html 안의 값과 같은 값을 그대로 옮겨 적으면 됩니다)
  firebase: {
    apiKey: "AIzaSyAfizlzLBNDRHwzEkSpJ35mSJAKvbuw6uo",
    authDomain: "power-market-f9573.firebaseapp.com",
    projectId: "power-market-f9573",
    storageBucket: "power-market-f9573.firebasestorage.app",
    messagingSenderId: "1005808106144",
    appId: "1:1005808106144:web:faef2e17c612833aec67c5"
  },

  // 2) 푸시 알림 설정 (설정방법.md 참고) — 비워 두면 알림은 "앱이 열려 있을 때만" 동작합니다.
  workerUrl: "sparkling-sunset-3f7a.sillan3.workers.dev",        // 예: "https://nanum-push.내아이디.workers.dev"
  vapidPublicKey: "BI8HhVL-NVOwAMdw2l_fBueIZKDbu924ayVJIMEdFc7fdtVgQSP-WDkWuH-OkuT17GzZ93FKZVmyKgHnd6Gmj-s"    // vapid-keys.html 에서 만든 "공개 키"
};
