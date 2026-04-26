#!/usr/bin/env node

import argon2 from "argon2";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const [, , masterKey, adminPassword] = process.argv;

if (!masterKey || !adminPassword) {
    console.error("Uso: node reset-auth.js <masterKey> <adminPassword>");
    process.exit(1);
}

/* * Ejecuta el flujo de reseteo de credenciales maestras y de administrador.
 * Elimina las sesiones activas y reemplaza las credenciales existentes en la base de datos 
 * manteniendo intacta la información operativa de la almazara.
 */
async function main() {
    const db = await open({
        filename: "./database.sqlite",
        driver: sqlite3.Database,
    });

    console.log("Reseteando credenciales de autenticación...");

    try {
        const masterHash = await argon2.hash(String(masterKey));
        const passHash = await argon2.hash(String(adminPassword));
        const createdAt = new Date().toISOString();

        await db.run("DELETE FROM users WHERE dni = 'admin'");
        console.log("Usuario admin anterior eliminado");

        await db.run(
            "INSERT INTO users (dni, password_hash, created_at) VALUES ('admin', ?, ?)",
            [passHash, createdAt]
        );
        console.log("Usuario admin creado con nueva contraseña");

        await db.run("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

        await db.run(
            "INSERT INTO settings (key, value) VALUES ('master_key_hash', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            [masterHash]
        );
        console.log("Clave maestra actualizada");

        await db.run("DELETE FROM sessions");
        console.log("Sesiones antiguas eliminadas");

        const lotes = await db.get("SELECT COUNT(*) as count FROM lotes");
        console.log(`Lotes preservados: ${lotes.count}`);

        await db.close();

        console.log("\nCredenciales reseteadas exitosamente.");
        console.log("Credenciales de acceso:");
        console.log(`Usuario (DNI): admin`);
        console.log(`Contraseña: ${adminPassword}`);
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    }
}

main();