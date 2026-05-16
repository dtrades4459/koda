import { useState } from "react";
import { AvatarCircle, outcomeColor, outcomeLetter, MONO, BODY, DISPLAY } from "./shared";

export function FriendsFeed({ friends, friendFeed, showAddFriend, setShowAddFriend, followHandleInput, setFollowHandleInput, followHandleMsg, followHandleLoading, followByHandle, followUser, removeFriend, unfollowUser, following, followers, followerProfiles, publishFeed, refreshFeed, reactToFeed, myFeedReactions, getMyCode, profile, C, inp, lbl, pillGhost, pillPrimary, openProfile }: any) {
  const [tab, setTab] = useState<"feed"|"people">("feed");

  const followingCount = following?.length || 0;
  const followerCount = followerProfiles?.length || 0;

  // helpers
  const tabBtn = (id: "feed"|"people", label: string) => (
    <button key={id} onClick={() => setTab(id)} style={{
      background: "none", border: "none", padding: "0 0 6px 0", cursor: "pointer",
      fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase",
      color: tab === id ? C.text : C.muted,
      borderBottom: tab === id ? `1px solid ${C.text}` : "1px solid transparent",
    }}>{label}</button>
  );

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "20px" }}>
          {tabBtn("feed", "Feed")}
          {tabBtn("people", `People${followingCount ? ` · ${followingCount}` : ""}`)}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {tab === "feed" && friends.length > 0 && (
            <button onClick={async () => { await publishFeed(); await refreshFeed(); }}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", padding: 0 }}>
              ↻
            </button>
          )}
          <button onClick={() => setShowAddFriend(!showAddFriend)}
            style={{ background: showAddFriend ? C.text : "transparent", color: showAddFriend ? C.bg : C.text, border: `1px solid ${C.text}`, borderRadius: "999px", padding: "6px 14px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {showAddFriend ? "Close" : "+ Follow"}
          </button>
        </div>
      </div>

      {/* ── Follow panel ── */}
      {showAddFriend && (
        <div style={{ marginBottom: "24px", padding: "18px", border: `1px solid ${C.border}`, borderRadius: "10px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Your handle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.12em", marginBottom: "3px" }}>YOUR HANDLE</div>
              <div style={{ fontFamily: MONO, fontSize: "14px", color: C.text, letterSpacing: "0.04em" }}>@{profile?.handle || "—"}</div>
            </div>
            <button onClick={async () => { await publishFeed(); }}
              style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", color: C.muted }}>
              Publish feed
            </button>
          </div>
          {/* Follow input */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.12em", marginBottom: "8px" }}>FOLLOW BY USERNAME</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={followHandleInput} onChange={e => setFollowHandleInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !followHandleLoading && followByHandle()}
                placeholder="@username" style={{ ...inp, flex: 1, margin: 0 }} disabled={followHandleLoading} />
              <button onClick={followByHandle} disabled={!followHandleInput.trim() || followHandleLoading}
                style={{ ...pillPrimary(!!followHandleInput.trim() && !followHandleLoading), width: "auto", padding: "10px 18px", opacity: followHandleLoading ? 0.6 : 1 }}>
                {followHandleLoading ? "…" : "Follow"}
              </button>
            </div>
            {followHandleMsg && (
              <div style={{ fontFamily: BODY, fontSize: "12px", color: followHandleMsg.includes("not found") || followHandleMsg.includes("That's you") ? C.red : C.green, marginTop: "8px" }}>
                {followHandleMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FEED tab ── */}
      {tab === "feed" && (
        <div>
          {friendFeed.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", borderTop: `1px solid ${C.border}` }}>
              {followingCount === 0 ? (
                <>
                  <div style={{ fontSize: "32px", marginBottom: "14px" }}>👥</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 500, color: C.text, marginBottom: "6px", letterSpacing: "-0.01em" }}>Follow traders to get started</div>
                  <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted, lineHeight: 1.6, maxWidth: "260px", margin: "0 auto 20px" }}>
                    Their trades and stats appear here in real time.
                  </div>
                  <button onClick={() => setShowAddFriend(true)}
                    style={{ background: C.text, color: C.bg, border: "none", borderRadius: "999px", padding: "10px 22px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    + Follow someone
                  </button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "28px", marginBottom: "12px" }}>📭</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: "17px", fontWeight: 500, color: C.text2, marginBottom: "6px" }}>Feed is empty</div>
                  <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted, lineHeight: 1.6 }}>
                    The traders you follow haven't published recently.
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Avatar strip — quick view of who you're following */}
              {following?.length > 0 && (
                <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "4px", marginBottom: "24px" }}>
                  {following.map((code: string) => {
                    const f = friends.find((x: any) => x.code === code) || { code, name: code, handle: "" };
                    return (
                      <div key={code} onClick={() => openProfile && f.handle && openProfile(f.handle)}
                        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", cursor: "pointer", flexShrink: 0 }}>
                        <AvatarCircle name={f.name} avatar={f.avatar} size={38} C={C} />
                        <span style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.04em", maxWidth: "44px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.handle ? `@${f.handle}` : f.name?.split(" ")[0] || code.slice(0, 6)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Feed items */}
              {friendFeed.map((item: any, i: number) => {
                const pnl = parseFloat(item.pnl || "0");
                const isWin = item.outcome === "Win";
                const isLoss = item.outcome === "Loss";
                const outcomeColor = isWin ? C.green : isLoss ? C.red : C.muted;
                const outcomeLetter = isWin ? "W" : isLoss ? "L" : "BE";
                return (
                  <div key={item.authorCode + "-" + item.tradeId + "-" + i}
                    style={{ padding: "18px 0", borderBottom: `1px solid ${C.border}` }}>
                    {/* Author row */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                      <div onClick={() => openProfile && item.authorHandle && openProfile(item.authorHandle)}
                        style={{ cursor: openProfile && item.authorHandle ? "pointer" : "default", display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                        <AvatarCircle name={item.authorName} avatar={item.authorAvatar} size={32} C={C} />
                        <div>
                          <div style={{ fontFamily: BODY, fontSize: "13px", fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{item.authorName}</div>
                          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.04em" }}>
                            {item.authorHandle ? `@${item.authorHandle}` : "@trader"} · {item.date}
                          </div>
                        </div>
                      </div>
                      {/* Outcome badge */}
                      <div style={{ fontFamily: MONO, fontSize: "11px", fontWeight: 700, color: outcomeColor, letterSpacing: "0.08em" }}>
                        {outcomeLetter}
                      </div>
                    </div>

                    {/* Trade card */}
                    <div style={{ background: C.panel ?? "transparent", border: `1px solid ${C.border}`, borderRadius: "8px", padding: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: 600, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{item.pair || "—"}</div>
                          {item.strategy && <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.06em", marginTop: "5px" }}>{item.strategy}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          {item.pnl && <div style={{ fontFamily: DISPLAY, fontSize: "20px", fontWeight: 600, color: pnl >= 0 ? C.green : C.red, letterSpacing: "-0.02em", lineHeight: 1 }}>
                            {pnl >= 0 ? "+" : ""}{item.pnl}R
                          </div>}
                          {item.rr && <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, marginTop: "5px" }}>{item.rr}R setup</div>}
                        </div>
                      </div>
                      {item.notes && (
                        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: `1px solid ${C.border}`, fontFamily: BODY, fontSize: "13px", color: C.text2, lineHeight: 1.6 }}>
                          {item.notes.slice(0, 160)}{item.notes.length > 160 ? "…" : ""}
                        </div>
                      )}
                    </div>

                    {/* Reactions row */}
                    <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                      {REACTIONS.map(rx => {
                        const raw = (item.reactions || {})[rx];
                        const count = typeof raw === "number" ? raw : (Array.isArray(raw) ? raw.length : 0);
                        const iMine = myFeedReactions?.has(`${item.authorCode}_${item.tradeId}_${rx}`);
                        const active = iMine || count > 0;
                        return (
                          <button key={rx} onClick={() => reactToFeed(item.authorCode, item.tradeId, rx)}
                            style={{
                              background: iMine ? C.text + "18" : "transparent",
                              color: iMine ? C.text : active ? C.text2 : C.muted,
                              border: `1px solid ${iMine ? C.text + "44" : active ? C.border2 : C.border}`,
                              borderRadius: "999px", padding: "4px 10px", cursor: "pointer",
                              fontSize: "11px", fontFamily: MONO, letterSpacing: "0.04em",
                              display: "flex", alignItems: "center", gap: "5px",
                            }}>
                            <span>{rx === "FIRE" ? "🔥" : rx === "GEM" ? "💎" : rx === "UP" ? "👍" : rx === "TARGET" ? "🎯" : rx === "PAIN" ? "💀" : "🤯"}</span>
                            {count > 0 && <span style={{ fontSize: "10px" }}>{count}</span>}
                          </button>
                        );
                      })}
                      <button onClick={() => { const o=item.outcome==="Win"?"WIN":item.outcome==="Loss"?"LOSS":"BE"; const p=item.pnl?` ${parseFloat(item.pnl)>=0?"+":""}${item.pnl}R`:""; window.open(`https://x.com/intent/post?text=${encodeURIComponent(`${o} ${item.pair||""}${p}${item.rr?" | "+item.rr+"R":""} — @tradrjournal\nhttps://tradrjournal.xyz`)}`, "_blank", "noopener"); }}
                        style={{ marginLeft: "auto", background: "transparent", border: `1px solid ${C.border}`, borderRadius: "999px", padding: "4px 10px", cursor: "pointer", fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em", color: C.muted, display: "flex", alignItems: "center", gap: "4px" }}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Share
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PEOPLE tab ── */}
      {tab === "people" && (
        <div>
          {followingCount === 0 && followerCount === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: "28px", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontFamily: DISPLAY, fontSize: "17px", fontWeight: 500, color: C.text2, marginBottom: "6px" }}>Nobody yet</div>
              <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted, lineHeight: 1.6, marginBottom: "18px" }}>Share your handle with other traders to build your network.</div>
              <button onClick={() => setShowAddFriend(true)}
                style={{ background: C.text, color: C.bg, border: "none", borderRadius: "999px", padding: "10px 22px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                + Follow someone
              </button>
            </div>
          ) : (
            <div>
              {/* Following */}
              {followingCount > 0 && (
                <div style={{ marginBottom: "28px" }}>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.12em", marginBottom: "12px" }}>
                    FOLLOWING · {followingCount}
                  </div>
                  {following.map((code: string) => {
                    const f = friends.find((x: any) => x.code === code) || { code, name: code, handle: "" };
                    const followsBack = followers?.includes(code);
                    return (
                      <div key={code} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div onClick={() => openProfile && f.handle && openProfile(f.handle)}
                          style={{ cursor: openProfile && f.handle ? "pointer" : "default", display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                          <AvatarCircle name={f.name} avatar={f.avatar} size={34} C={C} />
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontFamily: BODY, fontSize: "13px", fontWeight: 600, color: C.text }}>{f.name || code}</span>
                              {followsBack && <span style={{ fontFamily: MONO, fontSize: "8px", color: C.green, letterSpacing: "0.08em", border: `1px solid ${C.green}44`, borderRadius: "4px", padding: "1px 5px" }}>MUTUAL</span>}
                            </div>
                            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.04em", marginTop: "2px" }}>
                              {f.handle ? `@${f.handle}` : code.slice(0, 12)}
                            </div>
                          </div>
                        </div>
                        <button onClick={() => unfollowUser(code)}
                          style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: "6px", padding: "5px 10px", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em" }}>
                          Unfollow
                        </button>
 
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Followers */}
              {followerCount > 0 && (
                <div>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.12em", marginBottom: "12px" }}>
                    FOLLOWERS · {followerCount}
                  </div>
                  {followerProfiles.map((f: any) => {
                    const iFollow = following?.includes(f.code);
                    return (
                      <div key={f.code} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div onClick={() => openProfile && f.handle && openProfile(f.handle)}
                          style={{ cursor: openProfile && f.handle ? "pointer" : "default", display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                          <AvatarCircle name={f.name} avatar={f.avatar} size={34} C={C} />
                          <div>
                            <div style={{ fontFamily: BODY, fontSize: "13px", fontWeight: 600, color: C.text }}>{f.name || f.code}</div>
                            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.04em", marginTop: "2px" }}>
                              {f.handle ? `@${f.handle}` : f.code?.slice(0, 12)}
                            </div>
                          </div>
                        </div>
                        {iFollow ? (
                          <span style={{ fontFamily: MONO, fontSize: "10px", color: C.green, letterSpacing: "0.08em" }}>MUTUAL</span>
                        ) : (
                          <button onClick={() => { setFollowHandleInput(f.handle || f.code); followByHandle(); }}
                            style={{ background: C.text, color: C.bg, border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em" }}>
                            Follow back
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
