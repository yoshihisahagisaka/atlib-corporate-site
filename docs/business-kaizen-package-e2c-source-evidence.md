# 業務KAIZEN Package E2c Source Evidence

検証日: 2026-11-24 JST

## Source identity

- Corporate base: PR #74 HEAD `a7c14308a01da253d4842266ed3d9f94ac0bcb29`
- Sales Tools dependency: PR #100 HEAD `15122dcb0e65fb6d929e1428078de931d2c1017d`
- Backend endpoint contract: `POST /api/public/business-kaizen/anonymous-events`
- Actions: `diagnosis_start`, `diagnosis_complete`

## Published evidence before change

2026-11-24のread-only取得で、公開 `service.atlib.jp` はCorporate PR #74の対象assetと一致した。

- `/business-web/self-check/`: HTTP 200、782 bytes、SHA-256 `4b717a9cc201ca756b1161ddbf6319b6a7c9bbd20a07b9c22b44d20c34162ae6`
- `/business-web/self-check/self-check.js`: HTTP 200、38,873 bytes、SHA-256 `fb363ad6edc61e12e3370882e1aa80a282fc189c018248a4eaf561156721735b`
- Last-Modified: `Sun, 22 Nov 2026 12:22:33 GMT`

## Implementation boundaries

- Q01の定義済み回答が初めて保存された直後に、画面試行内で1回だけstartを開始する。
- `diagnose()`、結果DOM設定、必須結果見出し確認の後に、画面試行内で1回だけcompleteを開始する。
- restartは新しい画面試行を作る。再選択・再描画は同じ試行内で再送しない。
- 各イベントは別のinvisible Turnstile widgetを明示実行し、別tokenを取得する。
- Turnstile/APIは各5秒で打ち切る。失敗を表示せず、自動再送せず、診断・結果・相談導線を待たせない。
- payloadはevent type、token、URL由来UTM5項目だけ。回答・顧客情報・ID・cookie/session/fingerprintは送らない。
- sitekeyとAPI endpointは公開環境設定としてHTMLへresponse-time注入する。secretはCorporateへ持ち込まない。
- explicit enable、妥当なsitekey、正確なBackend path、HTTPS、allowlisted Originが揃う場合だけ有効。
- CSP変更は公開service hostの `/business-web` だけ。既存Sales Tools connect先を維持し、Turnstileのscript/frame/connectと設定済みAPI Originだけを追加する。

## Verification

- TypeScript build: PASS
- Business Web host/CSP/injection: 2/2 PASS
- E2c Browser Desktop/Mobile: 10/10 PASS
  - Turnstile render uses the documented explicit execution fields without a frontend `size: 'invisible'` value.
  - A non-responsive Turnstile script is stopped after five seconds; its script element and handlers are released, measurement is not retried, and diagnosis/result/consultation continue.
  - start/complete一回性、別token、restart
  - Turnstile失敗・API障害でも結果表示
  - 未設定時の無効化
  - strict UTM payload
  - keyboard操作、mobile操作
  - 相談フォームとTimeRex引継ぎ
- Existing Corporate suite: 26/29 PASS。残る3件はPR #74 HEADでも同じ内容で再現し、Recruit note banner、既存corporate asset version、Template Party license位置に関するbase不一致。E2c差分は該当ファイルを変更しない。

## Release gates

- Turnstile widget is configured as Invisible mode in Cloudflare; the frontend does not pass an unsupported `size: 'invisible'` render option.
- Real Turnstile execution, action/hostname validation, and the behavior of any widget not configured as Invisible remain a Staging acceptance gate. Confirm that no visible widget is clipped or hidden and that keyboard, screen-reader, and mobile operation remain usable.
- Before publication, confirm Cloudflare Invisible mode privacy disclosure and any required Turnstile branding or privacy/terms presentation against the production widget configuration.
- The three existing Corporate regression failures reproduced on PR #74 remain a separate release gate and are not changed by E2c.

1. Production/Test別Turnstile widget/sitekeyの作成とhostname設定。
2. E2bのProduction/Test設定、正式Origin、CORS、Migration適用が完了してからCorporate設定を有効化する。
3. Corporate環境変数のendpoint、allowlisted Origin、sitekeyを明示承認する。
4. Stagingで実Turnstile、CSP、API Origin、非対話動作、失敗時UXを確認する。
5. PR #74 baselineの既存3 FAILは別レーンで解消または正式に既知差分として承認する。
6. Deploy、Traffic、DNS、www redirectは別承認とする。
