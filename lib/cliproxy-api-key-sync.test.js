const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { syncApiKeyToCliProxyConfig } = require('./cliproxy-api-key-sync');

function withTempDir(run) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cliproxy-key-sync-'));
    try {
        return run(tempDir);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}

test('未配置 CLIProxyAPI config 路径时跳过同步', () => {
    const result = syncApiKeyToCliProxyConfig({
        apiKey: 'sk-yui-disabled-sync'
    });

    assert.deepEqual(result, { status: 'disabled' });
});

test('把新 API key 追加到顶层 api-keys 并创建配置备份', () => withTempDir((tempDir) => {
    const configPath = path.join(tempDir, 'config.yaml');
    fs.writeFileSync(configPath, [
        'host: "127.0.0.1"',
        'api-keys:',
        '  - sk-existing',
        'debug: true',
        ''
    ].join('\n'));

    const result = syncApiKeyToCliProxyConfig({
        apiKey: 'sk-yui-new-sync',
        configPath,
        now: () => new Date('2026-06-14T05:04:24.000Z')
    });

    assert.equal(result.status, 'appended');
    assert.equal(result.backupPath, path.join(tempDir, 'backups', 'config-before-add-shop-api-key-20260614-050424.yaml'));
    assert.equal(
        fs.readFileSync(configPath, 'utf8'),
        [
            'host: "127.0.0.1"',
            'api-keys:',
            '  - sk-existing',
            '  - "sk-yui-new-sync"',
            'debug: true',
            ''
        ].join('\n')
    );
    assert.equal(
        fs.readFileSync(result.backupPath, 'utf8'),
        [
            'host: "127.0.0.1"',
            'api-keys:',
            '  - sk-existing',
            'debug: true',
            ''
        ].join('\n')
    );
}));

test('API key 已存在时不重复写入配置', () => withTempDir((tempDir) => {
    const configPath = path.join(tempDir, 'config.yaml');
    const original = [
        'host: "127.0.0.1"',
        'api-keys:',
        '  - "sk-yui-existing-sync"',
        ''
    ].join('\n');
    fs.writeFileSync(configPath, original);

    const result = syncApiKeyToCliProxyConfig({
        apiKey: 'sk-yui-existing-sync',
        configPath
    });

    assert.deepEqual(result, { status: 'existing' });
    assert.equal(fs.readFileSync(configPath, 'utf8'), original);
    assert.equal(fs.existsSync(path.join(tempDir, 'backups')), false);
}));

test('缺少顶层 api-keys 段时拒绝同步', () => withTempDir((tempDir) => {
    const configPath = path.join(tempDir, 'config.yaml');
    fs.writeFileSync(configPath, 'host: "127.0.0.1"\n');

    assert.throws(
        () => syncApiKeyToCliProxyConfig({
            apiKey: 'sk-yui-missing-section',
            configPath
        }),
        /CLIProxyAPI config 缺少顶层 api-keys/
    );
}));
