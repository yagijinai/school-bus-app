# スクールバス運行管理システム 本番デプロイ手順ガイド

本システムをインターネット上に公開し、保護者・ドライバー・学校管理者が利用できる本番URLを発行する手順です。  
お好みの公開方法（**方法1: CLIから直接デプロイ** または **方法2: GitHub連携デプロイ**）を選択してください。

---

## 接続先 Supabase 情報（確認用）

本番ビルドには以下のSupabaseプロジェクトが設定されています：
- **Project URL**: `https://ouqeftqsremeemjjlhnn.supabase.co`
- **Anon Key**: `sb_publishable_7Hc9rKWtts98iQCoWSCxDw_W23s6r3-`

---

## 方法1: Vercel CLI を使用して直接デプロイ（最も簡単・数分で完了）

ターミナル（PowerShell / コマンドプロンプト）から直接コマンドを実行して公開する方法です。

### ステップ 1: Vercel CLI の実行
プロジェクトルート（`school-bus-app`）で以下のコマンドを実行します。

```bash
npx vercel
```

### ステップ 2: 対話型プロンプトへの回答
コマンドを実行すると、ターミナルでいくつか質問が表示されます。以下のように進めてください：

1. **`Log in to Vercel`**: 
   - 初回の場合、ブラウザが開きログインまたはメール認証が求められます（GitHub / Google / Email でログイン）。
2. **`Set up and deploy "~/school-bus-app"?`**:
   - `y` を入力して Enter。
3. **`Which scope do you want to deploy to?`**:
   - ご自身のアカウントを選択して Enter。
4. **`Link to existing project?`**:
   - `n` を入力して Enter（新規プロジェクト作成）。
5. **`What's your project's name?`**:
   - `school-bus-app`（または希望のプロジェクト名）を入力して Enter。
6. **`In which directory is your code located?`**:
   - `./` のまま Enter。
7. **`Want to modify settings?`**:
   - `n` を入力して Enter（`vercel.json` および Vite の設定が自動適用されます）。

### ステップ 3: 本番（Production）URL への昇格デプロイ
テスト用Preview URLが発行されたら、本番公開用コマンドを実行します。

```bash
npx vercel --prod
```

完了すると、画面に本番URL（例: `https://school-bus-app-xxxx.vercel.app`）が表示されます。

---

## 方法2: GitHub 連携でデプロイ（おすすめ：CI/CD自動更新）

GitHub リポジトリにプッシュし、Vercel または Cloudflare Pages と連携することで、コード修正時に自動で本番サイトが更新される構成にします。

### ステップ 1: GitHub リポジトリの作成 & プッシュ
1. [GitHub](https://github.com/) で新規リポジトリ（例: `school-bus-app`）を作成します。
2. ターミナルで以下を実行してコードをプッシュします：

```bash
git init
git add .
git commit -m "feat: initial commit for school bus app"
git branch -M main
git remote add origin https://github.com/<あなたのユーザー名>/school-bus-app.git
git push -u origin main
```

---

### ステップ 2-A: Vercel で公開する場合
1. [Vercel ダッシュボード](https://vercel.com/dashboard) にログインし、**「Add New...」>「Project」** をクリックします。
2. 先ほど作成した GitHub リポジトリ（`school-bus-app`）を選択し、**「Import」** をクリックします。
3. **Configure Project** 画面で以下を設定します：
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**（環境変数）に以下を追加：
     - `VITE_SUPABASE_URL`: `https://ouqeftqsremeemjjlhnn.supabase.co`
     - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_7Hc9rKWtts98iQCoWSCxDw_W23s6r3-`
4. **「Deploy」** をクリックします。約1分で本番URLが発行されます。

---

### ステップ 2-B: Cloudflare Pages で公開する場合
1. [Cloudflare ダッシュボード](https://dash.cloudflare.com/) にログインし、**「Workers & Pages」>「Create application」>「Pages」** を選択します。
2. **「Connect to Git」** を選択し、対象リポジトリを選択します。
3. **ビルド設定**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables**（環境変数）:
   - `VITE_SUPABASE_URL`: `https://ouqeftqsremeemjjlhnn.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `sb_publishable_7Hc9rKWtts98iQCoWSCxDw_W23s6r3-`
5. **「Save and Deploy」** をクリックします。

---

## 本番公開後の動作確認チェック項目

- [ ] **SPAリフレッシュ確認**: ブラウザで `/driver` や `/admin`、`/reservation` などのURLに直接アクセス・再読み込み（F5）しても404エラーにならず正常表示されるか。
- [ ] **Supabase通信確認**: 保護者画面での生徒照合や予約登録、ドライバー画面での点呼・遅延連絡がリアルタイムに反映されるか。
- [ ] **PWAインストール確認**: スマートフォン（iOS Safari の「ホーム画面に追加」/ Android Chrome の「アプリをインストール」）からホーム画面にアプリアイコンが追加できるか。
