#!/usr/bin/env node
/**
 * Script para resetear credenciales de autenticación sin tocar los lotes.
 * Uso: node reset-auth.js <masterKey> <adminPassword>
 * Ejemplo: node reset-auth.js "mi-clave-maestra" "mi-nueva-contraseña"
 */

import argon2 from "argon2";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const [, , masterKey, adminPassword] = process.argv;

if (!masterKey || !adminPassword) {
    console.error("❌ Uso: node reset-auth.js <masterKey> <adminPassword>");
    process.exit(1);
}

async function main() {
    const db = await open({
        filename: "./produccion.sqlite",
        driver: sqlite3.Database,
    });

    console.log("📝 Reseteando credenciales de autenticación...");

    try {
        // 1. Hashear las credenciales
        const masterHash = await argon2.hash(String(masterKey));
        const passHash = await argon2.hash(String(adminPassword));

        // 2. Eliminar usuario admin anterior si existe
        await db.run("DELETE FROM users WHERE username = 'admin'");
        console.log("🗑️  Usuario admin anterior eliminado (si existía)");

        // 3. Insertar nuevo usuario admin
        await db.run(
            "INSERT INTO users (username, password_hash) VALUES ('admin', ?)",
            [passHash]
        );
        console.log("✅ Usuario admin creado con nueva contraseña");

        // 4. Actualizar o insertar master_key_hash en settings
        await db.run(
            "INSERT INTO settings (key, value) VALUES ('master_key_hash', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [masterHash]
        );
        console.log("✅ Clave maestra actualizada");

        // 5. Limpiar sesiones antiguas
        await db.run("DELETE FROM sessions");
        console.log("🧹 Sesiones antiguas eliminadas");

        // 6. Verificar lotes preservados
        const lotes = await db.all("SELECT COUNT(*) as count FROM lotes");
        console.log(`✅ Lotes preservados: ${lotes[0].count}`);

        await db.close();
        console.log("\n✨ ¡Credenciales reseteadas exitosamente!");
        console.log("Ahora puedes ingresar con:");
        console.log(`  usuario: admin`);
        console.log(`  contraseña: ${adminPassword}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main();
