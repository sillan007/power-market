const CATEGORIES = [
  { key: "living", label: "생활용품", emoji: "🪴" },
  { key: "clothes", label: "의류", emoji: "🧥" },
  { key: "books", label: "도서", emoji: "📚" },
  { key: "kids", label: "유아/아동", emoji: "🧸" },
  { key: "kitchen", label: "주방용품", emoji: "🍽️" },
  { key: "electronics", label: "가전/전자", emoji: "🔌" },
  { key: "etc", label: "기타", emoji: "🎁" },
];

window.emojiFor = function(cat) { return CATEGORIES.find((c) => c.key === cat)?.emoji || "🎁"; }
window.labelFor = function(cat) { return CATEGORIES.find((c) => c.key === cat)?.label || "기타"; }
window.fmtDate = function(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return (dt.getMonth() + 1) + "월 " + dt.getDate() + "일 (" + days[dt.getDay()] + ")";
}
window.CATEGORIES_DATA = CATEGORIES;

window.EmptyState = function({ icon, text }) {
  return <div style={{ textAlign: "center", padding: 40, color: "#A39C8C" }}><h3>{icon}</h3><p>{text}</p></div>;
};

window.BrowseList = function({ items, myId, onRequest, onCancel, showDone, setShowDone, fbApi }) {
  const filteredItems = showDone ? items : items.filter(it => it.status !== "matched");
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={() => setShowDone(!showDone)} style={{ background: '#ECE4D2', padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: 12, color: '#555', fontWeight: 600 }}>
          {showDone ? "✓ 완료된 나눔 숨기기" : "👀 완료된 나눔도 보기"}
        </button>
      </div>
      {filteredItems.length === 0 ? (
        <window.EmptyState icon="📦" text="아직 올라온 나눔이 없어요." />
      ) : (
        filteredItems.map((it) => {
          const isMine = it.giverId === myId;
          const requested = it.requesters?.includes(myId);
          return (
            <div key={it.id} style={{ padding: "16px 0", borderBottom: "1px solid #ECE4D2" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, background: "#F1ECDD", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {window.emojiFor(it.category)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{it.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, background: it.status === "open" ? "#EAF0E3" : "#F3E9C9", color: it.status === "open" ? "#4C5C3E" : "#7A6420", padding: "3px 8px", borderRadius: 5 }}>
                      {it.status === "open" ? "나눔중" : "매칭완료"}
                    </span>
                  </div>
                  {it.desc && <div style={{ fontSize: 13, color: "#77715F", marginBottom: 6, lineHeight: 1.4 }}>{it.desc}</div>}
                  {it.image && (
                    <div style={{ marginTop: 8, marginBottom: 8 }}>
                      <img src={it.image} style={{ width: "100%", maxHeight: 220, borderRadius: 8, objectFit: "cover", border: "1px solid #EFEAE2" }} />
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, color: "#A39C8C", marginBottom: 8 }}>
                    {window.labelFor(it.category)} · {it.status === "open" ? "신청 " + (it.requesters?.length || 0) + "명" : "전달 완료"}
                  </div>
                  {!isMine && it.status === "open" && (
                    requested ? (
                      <button onClick={() => onCancel(it.id)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 7, border: "1px solid #D8CFB8", background: "#F6F2E8", color: "#6B6455", fontWeight: 600 }}>신청 취소하기</button>
                    ) : (
                      <button onClick={() => onRequest(it.id)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 7, border: "none", background: "#5C6E4B", color: "#F6F2E8", fontWeight: 600 }}>받고 싶어요</button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

window.CreateForm = function({ form, setForm, onSubmit, posting, imgFile, setImgFile, imgPreview, setImgPreview }) {
  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#5C5745", display: "block", marginBottom: 7 }}>무엇을 나누시겠어요?</label>
        <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="예: 아이 겨울 외투 (110cm)" style={{ width: "100%", padding: "11px 13px", borderRadius: 8, border: "1px solid #DCD3BC", background: "#FDFBF5", fontSize: 14.5 }} />
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#5C5745", display: "block", marginBottom: 7 }}>물품 사진 (최대 1장)</label>
        <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files; if (file) { setImgFile(file); setImgPreview(URL.createObjectURL(file)); } }} style={{ fontSize: 13, color: "#6B6455", marginBottom: 12 }} />
        {imgPreview && <div style={{ marginTop: 10, marginBottom: 12 }}><img src={imgPreview} style={{ width: 80, height: 80, borderRadius: 8, objectFit: "cover", border: "1px solid #DCD3BC" }} /></div>}
      </div>
      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#5C5745", display: "block", marginBottom: 7 }}>간단한 설명 (선택)</label>
        <textarea value={form.desc} onChange={(e) => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="상태, 크기 등을 적어주세요" rows={3} style={{ width: "100%", padding: "11px 13px", borderRadius: 8, border: "1px solid #DCD3BC", background: "#FDFBF5", fontSize: 14, resize: "none", lineHeight: 1.5 }} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#5C5745", display: "block", marginBottom: 9 }}>분류</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {window.CATEGORIES_DATA.map((c) => (
            <button key={c.key} onClick={() => setForm(f => ({ ...f, category: c.key }))} style={{ padding: "8px 12px", borderRadius: 20, border: form.category === c.key ? "1.5px solid #5C6E4B" : "1px solid #DCD3BC", background: form.category === c.key ? "#EAF0E3" : "#FDFBF5", color: form.category === c.key ? "#4C5C3E" : "#6B6455", fontSize: 13, fontWeight: 600 }}>{c.emoji} {c.label}</button>
          ))}
        </div>
      </div>
      <button onClick={onSubmit} disabled={posting} style={{ width: "100%", padding: "13px", borderRadius: 9, background: "#5C6E4B", color: "#F6F2E8", fontSize: 15, fontWeight: 700 }}>
        {posting ? "🚀 사진 및 물품 등록 중..." : "➕ 나눔 올리기"}
      </button>
    </div>
  );
};

window.MineList = function({ items, openPanel, togglePanel, pickedReceiver, setPickedReceiver, pickedDate, setPickedDate, onConfirm, onCancelItem }) {
  if (items.length === 0) return <window.EmptyState icon="🎁" text="아직 등록한 나눔이 없습니다." />;
  return (
    <div>
      {items.map((it) => (
        <div key={it.id} style={{ padding: "16px 0", borderBottom: "1px solid #ECE4D2" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{it.title}</span>
            <span style={{ fontSize: 11, fontWeight: 600, background: it.status === "open" ? "#EAF0E3" : "#F3E9C9", color: it.status === "open" ? "#4C5C3E" : "#7A6420", padding: "3px 8px", borderRadius: 5 }}>{it.status === "open" ? "나눔중" : "매칭완료"}</span>
          </div>
          {it.status === "open" && (
            <div>
              <div style={{ fontSize: 12.5, color: "#77715F", marginBottom: 10 }}>{it.requesters?.length ? `${it.requesters.length}명이 받고 싶어해요` : "아직 신청한 분이 없어요"}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {it.requesters?.length > 0 && !openPanel[it.id] && <button onClick={()=>togglePanel(it.id)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 7, background: "#5C6E4B", color: "#F6F2E8", fontWeight: 600 }}>받을 분 선택하기 ›</button>}
                {!openPanel[it.id] && <button onClick={()=>onCancelItem(it.id, it.imagePath)} style={{ fontSize: 13, padding: "7px 14px", borderRadius: 7, border: "1px solid #D8CFB8", background: "#FAF6EE", color: "#B34A4A", fontWeight: 600 }}>나눔 취소하기</button>}
              </div>
              {openPanel[it.id] && (
                <div style={{ background: "#F3EFE2", borderRadius: 10, padding: 14, marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#5C5745", marginBottom: 8 }}>받으실 분을 골라주세요</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                    {it.requesters?.map(r => <button key={r} onClick={()=>setPickedReceiver(p=>({...p, [it.id]:r}))} style={{ padding: "7px 12px", borderRadius: 20, border: pickedReceiver[it.id] === r ? "1.5px solid #5C6E4B" : "1px solid #DCD3BC", background: pickedReceiver[it.id] === r ? "#EAF0E3" : "#FDFBF5", color: pickedReceiver[it.id] === r ? "#4C5C3E" : "#6B6455", fontSize: 13, fontWeight: 600 }}>{r}</button>)}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#5C5745", marginBottom: 8 }}>전달 날짜 지정</div>
                  <input type="date" onChange={(e)=>setPickedDate(p=>({...p, [it.id]:e.target.value}))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #DCD3BC", marginBottom: 12 }} />
                  {/* 📍 전달 날짜 지정 입력창 바로 아래 줄입니다. */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {/* 🛠️ 오타로 누락되었던 확정하기 버튼의 닫는 태그(</button>)를 복구 완료했습니다 */}
                    <button onClick={() => onConfirm(it.id)} style={{ flex: 1, padding: "9px", borderRadius: 7, background: "#4C5C3E", color: "white", fontWeight: 600 }}>
                      확정하기
                    </button>
                    <button onClick={() => togglePanel(it.id)} style={{ padding: "9px 14px", borderRadius: 7, border: "1px solid #C4B9A3", color: "#6B6455" }}>
                      닫기
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 🛠️ 매칭완료 문구 출력 조건문의 깨진 중괄호 쌍을 완벽히 교정했습니다 */}
          {it.status === "matched" && (
            <div style={{ fontSize: 13.5, color: "#43A047", marginTop: 4, fontWeight: "bold" }}>
              ✓ {it.selectedReceiverId} 님에게 {window.fmtDate(it.dropOffDate)} 수령 예정
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

