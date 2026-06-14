const fs = require('node:fs');
const path = require('node:path');

function formatTimestamp(date) {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '').replace('T', '-').replace('Z', '');
}

function topLevelKeyLine(line, key) {
    return new RegExp(`^${key}:\\s*(?:#.*)?$`).test(line);
}

function isTopLevelYamlKey(line) {
    return /^[^\s#][^:]*:\s*/.test(line);
}

function unquoteYamlScalar(value) {
    const text = String(value || '').trim();
    if (text.startsWith('"') && text.endsWith('"')) {
        try {
            return JSON.parse(text);
        } catch {
            return text.slice(1, -1);
        }
    }
    if (text.startsWith("'") && text.endsWith("'")) {
        return text.slice(1, -1).replace(/''/g, "'");
    }
    return text;
}

function findApiKeysSection(lines) {
    const start = lines.findIndex((line) => topLevelKeyLine(line, 'api-keys'));
    if (start < 0) {
        throw new Error('CLIProxyAPI config 缺少顶层 api-keys。');
    }
    let end = lines.length;
    for (let index = start + 1; index < lines.length; index += 1) {
        if (isTopLevelYamlKey(lines[index])) {
            end = index;
            break;
        }
    }
    return { start, end };
}

function listApiKeys(lines, section) {
    return lines
        .slice(section.start + 1, section.end)
        .map((line) => line.match(/^\s*-\s*(.*?)\s*$/)?.[1])
        .filter(Boolean)
        .map(unquoteYamlScalar);
}

function listIndent(lines, section) {
    const itemLine = lines
        .slice(section.start + 1, section.end)
        .find((line) => /^\s*-\s*/.test(line));
    return itemLine?.match(/^(\s*)-\s*/)?.[1] || '  ';
}

function insertIndexForSection(lines, section) {
    if (section.end < lines.length) return section.end;
    return lines.at(-1) === '' ? lines.length - 1 : lines.length;
}

function syncApiKeyToCliProxyConfig(options = {}) {
    const apiKey = String(options.apiKey || '').trim();
    const configPath = String(options.configPath || '').trim();
    if (!configPath) return { status: 'disabled' };
    if (!apiKey) {
        throw new Error('CLIProxyAPI 同步需要 API key。');
    }

    const original = fs.readFileSync(configPath, 'utf8');
    const lines = original.split('\n');
    const section = findApiKeysSection(lines);
    if (listApiKeys(lines, section).includes(apiKey)) {
        return { status: 'existing' };
    }

    const backupDir = String(options.backupDir || '').trim() || path.join(path.dirname(configPath), 'backups');
    const now = typeof options.now === 'function' ? options.now() : new Date();
    const backupPath = path.join(backupDir, `config-before-add-shop-api-key-${formatTimestamp(new Date(now))}.yaml`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, original, { mode: 0o600 });

    const nextLines = [...lines];
    nextLines.splice(insertIndexForSection(lines, section), 0, `${listIndent(lines, section)}- ${JSON.stringify(apiKey)}`);
    const nextConfig = nextLines.join('\n');
    const tempPath = `${configPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, nextConfig, { mode: 0o600 });
    fs.renameSync(tempPath, configPath);

    return { status: 'appended', backupPath };
}

module.exports = {
    syncApiKeyToCliProxyConfig
};
