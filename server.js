require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');
const twilio = require('twilio');
const path = require('path');

// Twilio クライアントの初期化
const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: process.env.SESSION_SECRET || 'demo-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // HTTPSの場合はtrueに設定
}));

// メモリ内のユーザーストレージ（デモ用）
const users = new Map();

// ===== APIエンドポイント =====

// ユーザー登録開始 - Passkey Factorの作成
app.post('/api/register/start', async (req, res) => {
    try {
        const { username, displayName } = req.body;
        
        if (!username || !displayName) {
            return res.status(400).json({ error: 'Username and display name are required' });
        }

        // 既存ユーザーのチェック
        if (users.has(username)) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // ユニークなidentityの生成
        const identity = Buffer.from(username).toString('hex').padEnd(16, '0').substring(0, 16);

        // Passkey Factorの作成 (直接HTTP APIを使用)
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/Passkeys/Factors`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                    ).toString('base64')
                },
                body: JSON.stringify({
                    friendly_name: displayName,
                    identity: identity
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Twilio API error: ${error.message}`);
        }

        const factor = await response.json();

        // セッションにユーザー情報を保存
        req.session.currentRegistration = {
            username,
            displayName,
            identity,
            factorSid: factor.sid
        };

        res.json({
            success: true,
            options: factor.options,
            factorSid: factor.sid
        });
    } catch (error) {
        console.error('Registration start error:', error);
        res.status(500).json({ error: 'Failed to start registration' });
    }
});

// ユーザー登録完了 - Passkey検証
app.post('/api/register/complete', async (req, res) => {
    try {
        const { credential } = req.body;
        const registrationData = req.session.currentRegistration;

        if (!registrationData) {
            return res.status(400).json({ error: 'No registration in progress' });
        }

        // Passkey Factorの検証 (直接HTTP APIを使用)
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/Passkeys/VerifyFactor`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                    ).toString('base64')
                },
                body: JSON.stringify(credential)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Twilio API error: ${error.message}`);
        }

        const verifiedFactor = await response.json();

        // ユーザー情報の保存
        users.set(registrationData.username, {
            username: registrationData.username,
            displayName: registrationData.displayName,
            identity: registrationData.identity,
            factorSid: registrationData.factorSid,
            createdAt: new Date()
        });

        // セッションのクリア
        delete req.session.currentRegistration;

        res.json({
            success: true,
            message: 'Registration successful',
            username: registrationData.username
        });
    } catch (error) {
        console.error('Registration complete error:', error);
        res.status(500).json({ error: 'Failed to complete registration' });
    }
});

// ログイン開始 - Challenge作成
app.post('/api/login/start', async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        // ユーザーの存在確認
        const user = users.get(username);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Challengeの作成 (直接HTTP APIを使用)
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/Passkeys/Challenges`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                    ).toString('base64')
                },
                body: JSON.stringify({
                    identity: user.identity
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Twilio API error: ${error.message}`);
        }

        const challenge = await response.json();

        // セッションにChallenge情報を保存
        req.session.currentChallenge = {
            username: user.username,
            identity: user.identity,
            challengeSid: challenge.sid
        };

        res.json({
            success: true,
            options: challenge.options,
            challengeSid: challenge.sid
        });
    } catch (error) {
        console.error('Login start error:', error);
        res.status(500).json({ error: 'Failed to start login' });
    }
});

// ログイン完了 - Challenge検証
app.post('/api/login/complete', async (req, res) => {
    try {
        const { credential } = req.body;
        const challengeData = req.session.currentChallenge;

        if (!challengeData) {
            return res.status(400).json({ error: 'No login in progress' });
        }

        // Challengeの検証 (直接HTTP APIを使用)
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${process.env.TWILIO_SERVICE_SID}/Passkeys/ApproveChallenge`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + Buffer.from(
                        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
                    ).toString('base64')
                },
                body: JSON.stringify(credential)
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Twilio API error: ${error.message}`);
        }

        const verifiedChallenge = await response.json();

        if (verifiedChallenge.status === 'approved') {
            // ログイン成功
            req.session.user = users.get(challengeData.username);
            delete req.session.currentChallenge;

            res.json({
                success: true,
                message: 'Login successful',
                user: {
                    username: req.session.user.username,
                    displayName: req.session.user.displayName
                }
            });
        } else {
            res.status(401).json({ error: 'Authentication failed' });
        }
    } catch (error) {
        console.error('Login complete error:', error);
        res.status(500).json({ error: 'Failed to complete login' });
    }
});

// ログアウト
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out successfully' });
});

// 現在のユーザー情報取得
app.get('/api/user', (req, res) => {
    if (req.session.user) {
        res.json({
            authenticated: true,
            user: {
                username: req.session.user.username,
                displayName: req.session.user.displayName
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// デバッグ用：全ユーザー一覧
app.get('/api/debug/users', (req, res) => {
    const userList = Array.from(users.values()).map(u => ({
        username: u.username,
        displayName: u.displayName,
        createdAt: u.createdAt
    }));
    res.json(userList);
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Passkey Demo Server running on http://localhost:${PORT}`);
    console.log('\n重要: 使用前に以下を設定してください:');
    console.log('1. .env.exampleを.envにコピー');
    console.log('2. Twilioの認証情報を設定');
    console.log('3. Verify Serviceを作成してSIDを設定');
});
