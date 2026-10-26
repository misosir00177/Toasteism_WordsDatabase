# Toasteism — 資訊內容管理平台 v1.0

這是 **2026/10/23 資料庫分工**的可執行起始專案。使用 **React + Vite + Firebase Authentication + Cloud Firestore**。

> 重要：提供的是**完整網站原始碼與資料庫安全規則**，並未替你建立 Firebase 帳號、專案、真實資料庫或公開網站。必須先完成 Firebase 設定。10/23 會議僅確認資料庫製作分工與需與 TD 介接，Firebase 與欄位規格當時並未定案；此 v1 是供實作測試的新提案。

## 1. 功能清單

- Firebase Email/Password 管理員登入（非管理員不可查詢或修改內容）
- 即時載入 **議題清單**、資訊內容清單
- 議題：新增、重新命名（議題 ID 固定）、按議題篩選
- 資訊：新增、編輯、刪除、啟用／停用、搜尋
- 驗證字級只能 1–3；人工權重 `baseWeight` 只能介於 `0–1`
- 選定單一議題，匯出供 TouchDesigner 使用的 JSON（只匯出啟用資料）
- 響應式介面（電腦、平板、手機）

**本版本不包含：** 觀眾 Session 紀錄、根據撕取次數改權重、TD 即時雙向 API、結尾「未接收到幾％」的計算；這些仍需另外決定方法與分母。

## 2. Firestore Schema

### `topics/{topicId}`

例：`topics/ai-menu`

```json
{
  "name": "AI 菜單",
  "createdAt": "<Firestore timestamp>",
  "updatedAt": "<Firestore timestamp>"
}
```

`topicId` 只允許小寫英數及中間的連字號，建立後不可修改。可先建立四個二評使用過的議題：

| topicId | name |
| --- | --- |
| `ai-menu` | AI 菜單 |
| `six-seven` | SixSeven（67） |
| `online-shaming` | 社群公審 |
| `taipower-logo` | 台電 Logo |

### `contentItems/{autoDocId}`

```json
{
  "topicId": "ai-menu",
  "text": "店家可以節省菜單製作成本",
  "sizeLevel": 2,
  "baseWeight": 0.65,
  "isActive": true,
  "createdAt": "<Firestore timestamp>",
  "updatedAt": "<Firestore timestamp>"
}
```

- 一個 Document 代表**一組獨立閱讀／撕取的資訊**，不一定是單字。
- `id` 不額外存在 Document 欄位內，直接使用 Firestore 文件 ID。匯出時會一併附上 `id`。
- `baseWeight` 是**人工指定的初始值**，不是實際來源頻率，也不是觀眾留存率。
- `sizeLevel` 是排版字級，**不由 `baseWeight` 自動換算**。
- `isActive=false` 只代表保留於資料庫、不輸出給 TD；不是刪除。
- `createdAt`/`updatedAt` 使用 Firestore Server Timestamp。
- 資料庫沒有在 v1 判定「常見／少見」；若要讓心／邊位置符合 10/23 討論，團隊仍須確認如何把外部資料出現頻率映射到權重。

### `admins/{firebaseAuthUid}`

```json
{ "enabled": true }
```

此文件只可在 Firebase Console 或受信任後端建立，前端無法自行註冊成管理員。

## 3. Firebase 建置（首次需要做）

1. 進入 https://console.firebase.google.com/ ，建立 Firebase Project，專案名稱可自訂。
2. 專案中建立 **Cloud Firestore (Standard)**，選擇合適的資料庫區域；**建立後區域通常無法直接變更**。正式測試前不要開放全世界讀寫，必須部署此專案的 `firestore.rules`。
3. 左側 **Authentication → Sign-in method** 啟用 **Email/Password**。在 Authentication 的 Users 手動新增一個管理帳號。
4. 複製該使用者的 `UID`。到 Firestore Data 分頁，新增 `admins` collection，Document ID 填入該 `UID`，欄位 `enabled`（boolean）設 `true`。如已有 `admins`，新增相應 Document 即可。
5. 到 Firebase Project settings → Your apps → 新增一個 **Web App**，複製 `firebaseConfig`。
6. 在本機專案根目錄建立 `.env`：

   ```bash
   cp .env.example .env
   ```

   依 Firebase Web App 的設定，把 `.env` 中 `VITE_FIREBASE_...` 六個欄位填好。
7. 安裝與啟動（建議 Node.js 20.19+ 或 22.12+）：

   ```bash
   npm install
   npm run dev
   ```

   開啟命令列顯示的 URL（例如 http://localhost:5173 ）。使用建立的 Email/Password 登入。

   若只想驗證 JSON 範例格式，不必連接 Firebase，可執行 `npm run test:contract`。

> **重要：** `.env` 內的 Firebase Web 設定並不是 Admin SDK 的私密服務帳戶金鑰，前端 SDK 預期會使用這些設定。真正的存取管制是 **Authentication + Firestore Security Rules**。切勿把 Service Account JSON、private key 或管理員密碼放進前端與 Git 儲存庫。

### 管理員無權限？

- 確認 `admins/{UID}` 文件 ID 與 Authentication 使用者的 UID **完全相同**。
- 確認 `enabled` 是 `boolean true`，不是字串 `"true"`。
- 確認 Firestore Rules 已套用本專案版本，且 `.env` 指向同一個 Firebase Project。
- `admins` 的讀取只允許目前已登入的本人，其他資料的讀寫必須是有效管理員。

## 4. 發布 Firestore Security Rules / Firebase Hosting

建議先將 `firestore.rules` 發布後，再登入測試，不要把 Firestore 留在公開測試規則。

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore
```

前端本機測試通過後：

```bash
npm run build
firebase deploy --only hosting
```

部署會把 Vite 的 `dist/` 靜態網站發佈至 Firebase Hosting，通常可用 `https://<project-id>.web.app` 開啟。

`firebase.json` 已指向 `dist` 與 `firestore.rules`，**不必再執行 `firebase init` 覆蓋現有設定**。部署 Rules 時請注意：CLI 的本地規則可能覆寫 Console 目前的規則，先核對是否有其他應用共用此 Firestore 資料庫。

**帳戶限制：** Authentication 可以登入，**不代表**可讀寫任何資料；只有 Firestore `admins/{UID}.enabled == true` 才可操作。

## 5. TouchDesigner 輸出契約

在「資訊內容管理」頁面上方選擇單一議題 → 點「匯出 JSON」。

`examples/td-export-example.json` 是範例，並非任何研究確認權重。

```json
{
  "schemaVersion": 1,
  "topicId": "ai-menu",
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "items": [
    {
      "id": "example-k001",
      "text": "節省菜單製作成本",
      "sizeLevel": 3,
      "baseWeight": 0.8
    }
  ]
}
```

這個格式刻意只提供最基本顯示資料，不包含瀏覽器登入憑證、FireStore Timestamp 或資料庫操作權限。

**第一階段與田宏翔的交接測試：**
1. 確定 TD 能讀取 JSON（File In DAT、Text DAT 或由 Python 在 TD 載入）。
2. TD 依 `id` 識別資料單位，不要用文字內容當 ID。
3. TD 先按 `sizeLevel` 決定字級，按 `baseWeight` 作為人工權重參數；心／邊規則待討論。
4. 同一筆資料改文字時 `id` 不變，可維持原本的撕取/位置對應。

未來需要「TD 即時讀 Firebase」時，建議另做**受控的 HTTP 資料轉接服務**（例如 Firebase Cloud Functions 或展場本機同步程式）。**不要把管理員帳密、Firebase Admin SDK 的服務帳戶金鑰直接寫到 TD 前端或公開端。**

## 6. 測試清單

- [ ] 正確設定 `.env`，有管理員帳號能登入。
- [ ] 未設 `admins` 的一般登入帳號，無法看資料或編輯。
- [ ] 新增議題 `ai-menu` 成功，不能建立重複 ID。
- [ ] 新增字級 1–3／權重 0–1 的資料成功；非法值會被擋下。
- [ ] 修改內容後文件 ID 保持不變。
- [ ] 停用某一筆後，JSON 匯出不包含該筆。
- [ ] 刪除前需確認；議題無法直接刪除，避免孤兒資料。
- [ ] 同一個資料庫的兩個管理員瀏覽器可同步看見更新。
- [ ] TD 可讀取 `schemaVersion=1` 的 JSON，正確辨識中文內容。
- [ ] 部署前用 Firebase Emulator 測試 Rules（含權限拒絕與欄位錯誤）。

## 7. 未來擴充建議（不在 v1）

如後續確認要記錄觀眾撕取行為，增加獨立 `sessions` 及 `sessionEvents`，記錄匿名 session ID、topicId、itemId、`kept/removed`、時間；**絕不覆蓋 contentItems 的 `baseWeight`**。先決定資料保留期限、是否需要使用者告知，以及結尾％數的**分母**，再決定是否實作統計。

## 8. 專案目錄

```text
toasteism-content-manager/
├─ .env.example
├─ .gitignore
├─ firebase.json
├─ firestore.rules
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ README.md
├─ scripts/
│  └─ verify-example.mjs
├─ examples/
│  └─ td-export-example.json
└─ src/
   ├─ main.tsx
   ├─ App.tsx
   ├─ firebase.ts
   ├─ types.ts
   ├─ vite-env.d.ts
   └─ style.css
```

## 資料來源與規格狀態

- **專案已確認：** 2026/10/23 確認版 — 資料庫由魏直彦製作；議題與關鍵字需提供 TD；心／邊依常見／少見資訊，不固定正反角色；一組意見作為撕取單位仍在測試；缺失％數的分母未定。
- **本版新提案：** Firebase Firestore + React + Vite、`topics`/`contentItems`/`admins` Collections、`baseWeight ∈ [0,1]`、字級 1–3、僅管理員可讀寫、JSON 匯出格式。
- **官方參考：** https://firebase.google.com/docs/firestore/quickstart 、 https://firebase.google.com/docs/rules/get-started 、 https://firebase.google.com/docs/hosting/quickstart
