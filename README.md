# Passkey認証デモアプリケーション

Twilio Verify Passkeysを使用した生体認証デモアプリケーションです。

## 機能

- パスキーを使用したユーザー登録
- パスキーを使用したログイン認証
- 生体認証（指紋、顔認証など）対応
- フィッシング耐性のある認証方式

## 必要な環境

- Node.js v20以上（**重要**: Twilio Verify Passkeys Web SDKの要件）
- npm または yarn
- **Twilioアカウント（Passkeysベータアクセス承認済み）**
- 最新のWebブラウザ（Chrome、Safari、Edge、Firefox）

**重要**: Twilio Verify Passkeysは現在ベータ版です。使用するには[Twilioサポート](https://console.twilio.com/)に連絡してベータアクセスをリクエストする必要があります。

## セットアップ手順

### 1. 依存関係のインストール

```bash
cd passkey-demo
npm install
```

### 2. Twilioの設定

#### 2.1 Twilioアカウントの作成と認証情報の取得
1. [Twilio](https://www.twilio.com)でアカウントを作成
2. [Twilioコンソール](https://console.twilio.com/)にログイン
3. **Account SID**と**Auth Token**を取得（ダッシュボードに表示されています）

#### 2.2 Passkeysベータアクセスの確認
- Twilioサポートから**Passkeysベータアクセス承認済み**であることを確認
- アクセスがない場合は、Twilioサポートにリクエストしてください

#### 2.3 自動セットアップスクリプトの使用（推奨）

`.env`ファイルに認証情報を設定後、以下のコマンドを実行：

```bash
# .env.exampleを.envにコピー
cp .env.example .env

# .envファイルを編集してTWILIO_ACCOUNT_SIDとTWILIO_AUTH_TOKENを設定
# その後、セットアップスクリプトを実行
node setup.js
```

セットアップスクリプトは以下を自動実行します：
- Passkeys対応Verify Serviceの作成
- `.env`ファイルへのService SIDの自動設定
- Passkeys設定の検証

#### 2.4 手動でVerify Serviceを作成（任意）

自動セットアップの代わりに、手動で作成することもできます：

```bash
curl -X POST "https://verify.twilio.com/v2/Services" \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
  --data-urlencode "Name=Passkey Demo Service" \
  --data-urlencode "Passkeys.RelyingParty.Id=localhost" \
  --data-urlencode "Passkeys.RelyingParty.Name=Passkey Demo App" \
  --data-urlencode "Passkeys.RelyingParty.Origins=http://localhost:3000" \
  --data-urlencode "Passkeys.AuthenticatorAttachment=platform" \
  --data-urlencode "Passkeys.DiscoverableCredentials=preferred" \
  --data-urlencode "Passkeys.UserVerification=preferred"
```

レスポンスから`sid`（VAで始まる文字列）をコピーして、`.env`の`TWILIO_SERVICE_SID`に設定してください。

### 3. 環境変数の設定

自動セットアップスクリプト（`node setup.js`）を使用した場合、`.env`ファイルは自動的に更新されます。

手動で設定する場合は、`.env`ファイルを編集して以下の情報を設定：

```env
# Twilio認証情報（必須）
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_SERVICE_SID=VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# サーバー設定
PORT=3000 
SESSION_SECRET=random_secret_string_here

# Relying Party設定（Passkeys用）
RP_ID=localhost
RP_NAME=Passkey Demo App
RP_ORIGIN=http://localhost:3000
```

**ヒント**: `SESSION_SECRET`にはランダムな文字列を生成して設定してください。

```bash
# ランダムな文字列を生成（macOS/Linux）
openssl rand -base64 32
```

### 4. アプリケーションの起動

```bash
# 本番モード
npm start

# 開発モード（自動リロード）
npm run dev
```

### 5. ブラウザでアクセス

```
http://localhost:3000
```

## 使い方

### 新規登録
1. 「新規登録」リンクをクリック
2. ユーザー名と表示名を入力
3. 「パスキーで登録」をクリック
4. ブラウザのパスキー作成ダイアログに従って生体認証を実行
5. パスキーがデバイスに保存される

### ログイン
1. 登録したユーザー名を入力
2. 「パスキーでログイン」をクリック
3. 生体認証（指紋、顔認証など）を実行
4. 認証成功後、ダッシュボードが表示される

## トラブルシューティング

### パスキーが作成できない
- ブラウザが最新版であることを確認
- HTTPSまたはlocalhost環境でアクセスしているか確認
- デバイスに生体認証機能があることを確認

### Twilioエラー

#### `Error: accountSid must start with AC`
- `.env`ファイルの`TWILIO_ACCOUNT_SID`が正しく設定されているか確認
- プレースホルダー（`your_account_sid_here`）のままになっていないか確認

#### `Error 20500: An internal server error has occurred`
以下を確認してください：
1. **Passkeysベータアクセスが承認されているか**
   - Twilioサポートに確認
2. **Passkeys設定が正しく構成されているか**
   ```bash
   # Service設定を確認
   curl -X GET "https://verify.twilio.com/v2/Services/$TWILIO_SERVICE_SID" \
     -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN
   ```
   - レスポンスの`passkeys`オブジェクトが`null`でないことを確認
3. **正しいAPIエンドポイントを使用しているか**
   - `/v2/Services/{ServiceSid}/Passkeys/Factors` を使用
   - 古い `/Entities/{Identity}/Factors` ではない

#### `listen EADDRINUSE: address already in use :::3000`
ポート3000が既に使用されています：
```bash
# プロセスを確認して終了
lsof -ti:3000 | xargs kill -9
```

### セッションエラー
- ブラウザのCookieが有効になっているか確認
- シークレットモードでない通常のブラウザで試す

### Node.js SDKの問題
現在、Twilio Node.js SDKはPasskeys専用のメソッドに完全対応していません。このデモアプリでは直接HTTP APIを使用しています：
- `/Passkeys/Factors` - Factor作成
- `/Passkeys/VerifyFactor` - 登録検証
- `/Passkeys/Challenges` - Challenge作成
- `/Passkeys/ApproveChallenge` - ログイン検証

## セキュリティ注意事項

**注意**: このアプリケーションはデモ用です。本番環境では以下の対策を実装してください：

- HTTPSの使用
- より強固なセッション管理
- データベースによるユーザー管理
- レート制限
- 適切なエラーハンドリング
- ログ記録とモニタリング

## ファイル構成

```
passkey-demo/
├── server.js           # Expressサーバー（Passkeys API統合）
├── setup.js            # 自動セットアップスクリプト
├── public/
│   ├── index.html     # メインHTML
│   ├── app.js         # フロントエンドJS（WebAuthn API）
│   └── styles.css     # スタイルシート
├── docs/               # Twilioベータドキュメント
│   ├── 1 Verify Passkeys Client Library Technical Overview.md
│   ├── 2 Verify Passkeys quickstart.md
│   ├── 3 Entity Resource.md
│   ├── 4 Factor Resource.md
│   └── 5 Challenge Resource.md
├── package.json       # 依存関係
├── .env.example       # 環境変数テンプレート
└── README.md          # このファイル
```

## 技術スタック

- **Backend**: Node.js v20+, Express
- **Authentication**: Twilio Verify Passkeys API (Beta)
- **Frontend**: Vanilla JavaScript, WebAuthn API
- **Styling**: CSS3
- **Session Management**: express-session

## API実装の詳細

このデモアプリは、Twilio Verify Passkeys APIを直接HTTP呼び出しで使用しています：

### 登録フロー
1. **Factor作成**: `POST /v2/Services/{ServiceSid}/Passkeys/Factors`
   - ユーザーのidentityとfriendly_nameを送信
   - レスポンスで`options.publicKey`（WebAuthn用）を取得

2. **登録検証**: `POST /v2/Services/{ServiceSid}/Passkeys/VerifyFactor`
   - ブラウザで生成されたcredentialを送信
   - Factorのステータスが`verified`になる

### 認証フロー
1. **Challenge作成**: `POST /v2/Services/{ServiceSid}/Passkeys/Challenges`
   - ユーザーのidentityを送信
   - レスポンスで`options.publicKey`（認証用）を取得

2. **Challenge承認**: `POST /v2/Services/{ServiceSid}/Passkeys/ApproveChallenge`
   - ブラウザで署名されたcredentialを送信
   - Challengeのステータスが`approved`になる

## 開発のヒント

### デバッグモード
サーバーのログを詳細に確認する：
```bash
# 開発モード（nodemon使用）
npm run dev
```

### Passkeys設定の確認
現在のサービス設定を確認：
```bash
curl -X GET "https://verify.twilio.com/v2/Services/$TWILIO_SERVICE_SID" \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN | jq .passkeys
```

### テストユーザーの管理
現在、ユーザーはメモリ内（`Map`）に保存されています。サーバーを再起動するとユーザーデータは消去されます。

## リソース

### 公式ドキュメント
- [Twilio Verify API](https://www.twilio.com/docs/verify/api)
- [WebAuthn Specification](https://www.w3.org/TR/webauthn/)
- [FIDO Alliance](https://fidoalliance.org/)

### ベータドキュメント
プロジェクトの`docs/`フォルダにTwilio Passkeysのベータドキュメントが含まれています：
- Verify Passkeys quickstart
- Factor Resource API
- Challenge Resource API

## よくある質問

### Q: 本番環境で使用できますか？
A: Twilio Verify Passkeysは現在ベータ版です。本番環境での使用前にTwilioサポートに確認してください。

### Q: モバイルアプリでも動作しますか？
A: このデモはWeb用です。モバイルアプリには[Twilio Verify Passkeys SDK](https://github.com/twilio/twilio-verify-passkeys)を使用してください。

### Q: 複数のデバイスで同じアカウントを使用できますか？
A: はい。各デバイスで登録すれば、複数のPasskeyを1つのアカウントに紐付けることができます。

## ライセンス

MIT
