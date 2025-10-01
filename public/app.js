// DOM要素の取得
const authContainer = document.getElementById('auth-container');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');

// フォーム切り替え
document.getElementById('show-register').addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    clearMessages();
});

document.getElementById('show-login').addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
    clearMessages();
});

// ユーティリティ関数
function showLoading(show = true) {
    loading.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 5000);
}

function clearMessages() {
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
}

// WebAuthn JSON ライブラリが読み込まれるまで待つ
function waitForWebAuthnJSON() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (window.webauthnJSON) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

// ユーザー登録処理
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    
    const username = document.getElementById('register-username').value;
    const displayName = document.getElementById('register-displayname').value;
    
    try {
        showLoading(true);
        
        // WebAuthn JSONライブラリの準備を待つ
        await waitForWebAuthnJSON();
        
        // 1. サーバーから登録オプションを取得
        const startResponse = await fetch('/api/register/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, displayName })
        });
        
        if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || 'Registration failed');
        }
        
        const { options } = await startResponse.json();
        
        // 2. WebAuthnを使用してPasskeyを作成
        const creationOptions = window.webauthnJSON.parseCreationOptionsFromJSON(options);
        const credential = await window.webauthnJSON.create(creationOptions);
        
        // 3. 作成したクレデンシャルをサーバーに送信
        const completeResponse = await fetch('/api/register/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        
        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Registration verification failed');
        }
        
        const result = await completeResponse.json();
        showSuccess('登録が完了しました！ログインしてください。');
        
        // ログインフォームに切り替え
        setTimeout(() => {
            registerForm.style.display = 'none';
            loginForm.style.display = 'block';
            document.getElementById('login-username').value = username;
        }, 2000);
        
    } catch (error) {
        console.error('Registration error:', error);
        if (error.name === 'NotAllowedError') {
            showError('パスキーの作成がキャンセルされました');
        } else if (error.name === 'InvalidStateError') {
            showError('このデバイスには既にパスキーが登録されています');
        } else {
            showError(`登録エラー: ${error.message}`);
        }
    } finally {
        showLoading(false);
    }
});

// ログイン処理
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessages();
    
    const username = document.getElementById('login-username').value;
    
    try {
        showLoading(true);
        
        // WebAuthn JSONライブラリの準備を待つ
        await waitForWebAuthnJSON();
        
        // 1. サーバーから認証チャレンジを取得
        const startResponse = await fetch('/api/login/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        if (!startResponse.ok) {
            const error = await startResponse.json();
            throw new Error(error.error || 'Login failed');
        }
        
        const { options } = await startResponse.json();
        
        // 2. WebAuthnを使用してPasskeyで認証
        const requestOptions = window.webauthnJSON.parseRequestOptionsFromJSON(options);
        const credential = await window.webauthnJSON.get(requestOptions);
        
        // 3. 認証結果をサーバーに送信
        const completeResponse = await fetch('/api/login/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        
        if (!completeResponse.ok) {
            const error = await completeResponse.json();
            throw new Error(error.error || 'Authentication failed');
        }
        
        const result = await completeResponse.json();
        
        // ダッシュボードを表示
        showDashboard(result.user);
        
    } catch (error) {
        console.error('Login error:', error);
        if (error.name === 'NotAllowedError') {
            showError('認証がキャンセルされました');
        } else if (error.name === 'InvalidStateError') {
            showError('パスキーが見つかりません');
        } else {
            showError(`ログインエラー: ${error.message}`);
        }
    } finally {
        showLoading(false);
    }
});

// ダッシュボード表示
function showDashboard(user) {
    authContainer.style.display = 'none';
    dashboard.style.display = 'block';
    
    document.getElementById('user-displayname').textContent = user.displayName;
    document.getElementById('user-username').textContent = user.username;
}

// ログアウト処理
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await fetch('/api/logout', { method: 'POST' });
        dashboard.style.display = 'none';
        authContainer.style.display = 'block';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        showSuccess('ログアウトしました');
    } catch (error) {
        showError('ログアウトエラー: ' + error.message);
    }
});

// デバッグ用：ユーザー一覧表示
document.getElementById('show-users-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/api/debug/users');
        const users = await response.json();
        
        const usersList = document.getElementById('users-list');
        if (users.length === 0) {
            usersList.textContent = '登録ユーザーはいません';
        } else {
            usersList.textContent = JSON.stringify(users, null, 2);
        }
    } catch (error) {
        console.error('Error fetching users:', error);
    }
});

// ページ読み込み時にログイン状態をチェック
window.addEventListener('load', async () => {
    try {
        const response = await fetch('/api/user');
        const data = await response.json();
        
        if (data.authenticated) {
            showDashboard(data.user);
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
});

// Passkey対応チェック
async function checkPasskeySupport() {
    // WebAuthnがサポートされているかチェック
    if (!window.PublicKeyCredential) {
        showError('このブラウザはPasskeyに対応していません。最新のブラウザをお使いください。');
        document.querySelectorAll('form button').forEach(btn => btn.disabled = true);
        return false;
    }
    
    // プラットフォーム認証器が利用可能かチェック
    try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            console.warn('Platform authenticator not available, but roaming authenticators might work');
        }
    } catch (error) {
        console.error('Error checking platform authenticator:', error);
    }
    
    return true;
}

// 初期化
checkPasskeySupport();
