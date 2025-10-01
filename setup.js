#!/usr/bin/env node

/**
 * Twilio Verify Serviceの自動セットアップスクリプト
 * 
 * 使用方法:
 * 1. TWILIO_ACCOUNT_SIDとTWILIO_AUTH_TOKENを環境変数に設定
 * 2. node setup.js を実行
 */

require('dotenv').config();
const twilio = require('twilio');
const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setupTwilioService() {
    console.log('Twilio Verify Passkeys セットアップツール\n');

    // 環境変数チェック
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.error('エラー: TWILIO_ACCOUNT_SID と TWILIO_AUTH_TOKEN が必要です');
        console.log('\n以下の手順に従ってください:');
        console.log('1. .env.exampleを.envにコピー');
        console.log('2. Twilioの認証情報を.envファイルに記入');
        console.log('3. 再度このスクリプトを実行\n');
        process.exit(1);
    }

    const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
    );

    try {
        console.log('📋 現在の設定:');
        console.log(`Account SID: ${process.env.TWILIO_ACCOUNT_SID.substring(0, 10)}...`);
        console.log(`RP ID: localhost`);
        console.log(`RP Origin: http://localhost:3000\n`);

        const createNew = await question('新しいVerify Serviceを作成しますか？ (y/n): ');
        
        if (createNew.toLowerCase() === 'y') {
            console.log('\n⏳ Verify Serviceを作成中...');
            
            const service = await client.verify.v2.services.create({
                friendlyName: 'Passkey Demo Service',
                // Passkeyの設定
                'Passkeys.RelyingParty.Id': 'localhost',
                'Passkeys.RelyingParty.Name': 'Passkey Demo App',
                'Passkeys.RelyingParty.Origins': ['http://localhost:3000'],
                'Passkeys.AuthenticatorAttachment': 'platform',
                'Passkeys.DiscoverableCredentials': 'preferred',
                'Passkeys.UserVerification': 'preferred'
            });

            console.log('\nVerify Serviceが作成されました！');
            console.log(`Service SID: ${service.sid}`);

            // .envファイルを更新
            const envPath = '.env';
            let envContent = '';

            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf8');
                // TWILIO_SERVICE_SIDを更新または追加
                if (envContent.includes('TWILIO_SERVICE_SID=')) {
                    envContent = envContent.replace(
                        /TWILIO_SERVICE_SID=.*/,
                        `TWILIO_SERVICE_SID=${service.sid}`
                    );
                } else {
                    envContent += `\nTWILIO_SERVICE_SID=${service.sid}`;
                }
            } else {
                // .envファイルが存在しない場合は作成
                envContent = `TWILIO_ACCOUNT_SID=${process.env.TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${process.env.TWILIO_AUTH_TOKEN}
TWILIO_SERVICE_SID=${service.sid}
PORT=3000
SESSION_SECRET=${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}
RP_ID=localhost
RP_NAME=Passkey Demo App
RP_ORIGIN=http://localhost:3000`;
            }

            fs.writeFileSync(envPath, envContent);
            console.log('.envファイルが更新されました');

            console.log('\nセットアップ完了！');
            console.log('以下のコマンドでアプリケーションを起動できます:');
            console.log('  npm start');
            console.log('\nブラウザで http://localhost:3000 にアクセスしてください');
            
        } else {
            // 既存のService SIDを使用
            const serviceSid = await question('\n既存のService SIDを入力してください (VAで始まる文字列): ');
            
            if (!serviceSid.startsWith('VA')) {
                console.error('無効なService SIDです');
                process.exit(1);
            }

            // サービスの存在確認
            try {
                const service = await client.verify.v2.services(serviceSid).fetch();
                console.log(`\nService "${service.friendlyName}" が見つかりました`);

                // .envファイルを更新
                const envPath = '.env';
                let envContent = '';

                if (fs.existsSync(envPath)) {
                    envContent = fs.readFileSync(envPath, 'utf8');
                    if (envContent.includes('TWILIO_SERVICE_SID=')) {
                        envContent = envContent.replace(
                            /TWILIO_SERVICE_SID=.*/,
                            `TWILIO_SERVICE_SID=${serviceSid}`
                        );
                    } else {
                        envContent += `\nTWILIO_SERVICE_SID=${serviceSid}`;
                    }
                } else {
                    envContent = `TWILIO_ACCOUNT_SID=${process.env.TWILIO_ACCOUNT_SID}
TWILIO_AUTH_TOKEN=${process.env.TWILIO_AUTH_TOKEN}
TWILIO_SERVICE_SID=${serviceSid}
PORT=3000
SESSION_SECRET=${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}
RP_ID=localhost
RP_NAME=Passkey Demo App
RP_ORIGIN=http://localhost:3000`;
                }

                fs.writeFileSync(envPath, envContent);
                console.log('.envファイルが更新されました');

            } catch (error) {
                console.error('Service SIDが見つかりません:', error.message);
                process.exit(1);
            }
        }
        
    } catch (error) {
        console.error('\nエラーが発生しました:', error.message);
        console.log('\n考えられる原因:');
        console.log('- Twilioの認証情報が正しくない');
        console.log('- インターネット接続の問題');
        console.log('- Twilioアカウントのクレジット不足');
        process.exit(1);
    } finally {
        rl.close();
    }
}

// メイン実行
setupTwilioService();
