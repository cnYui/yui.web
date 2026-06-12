#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const { reconcileUsageBilling } = require('../lib/shop-usage-reconcile');

function timestamp() {
    const date = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function parseArgs(argv) {
    const args = {
        apply: false,
        db: path.join(__dirname, '..', 'data', 'shop.sqlite'),
        auditLogDir: ''
    };
    for (let index = 2; index < argv.length; index += 1) {
        const item = argv[index];
        if (item === '--dry-run') args.apply = false;
        if (item === '--apply') args.apply = true;
        if (item === '--db') {
            args.db = argv[index + 1];
            index += 1;
        }
        if (item === '--audit-log-dir') {
            args.auditLogDir = argv[index + 1];
            index += 1;
        }
    }
    return args;
}

function backupShopDatabase(dbPath, backupDir = path.join(path.dirname(dbPath), 'backups'), stamp = timestamp()) {
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `shop-before-usage-reconcile-${stamp}.sqlite`);
    fs.copyFileSync(dbPath, backupPath);
    return backupPath;
}

function main(argv = process.argv) {
    const args = parseArgs(argv);
    const dbPath = path.resolve(args.db);
    if (!fs.existsSync(dbPath)) {
        throw new Error(`数据库不存在：${dbPath}`);
    }
    const backupPath = args.apply ? backupShopDatabase(dbPath) : '';
    const db = new Database(dbPath);
    try {
        const auditLogDir = args.auditLogDir
            || process.env.SHOP_CHARGE_AUDIT_LOG_DIR
            || path.join(path.dirname(dbPath), 'logs', 'shop-charge-records');
        const result = reconcileUsageBilling(db, { apply: args.apply, auditLogDir });
        console.log(JSON.stringify({ mode: args.apply ? 'apply' : 'dry-run', backupPath, result }, null, 2));
    } finally {
        db.close();
    }
}

if (require.main === module) {
    main();
}

module.exports = { backupShopDatabase, main, parseArgs };
