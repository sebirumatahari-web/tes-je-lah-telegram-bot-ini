// functions/bot.js
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// Konfigurasi Token (Nanti diisi di Netlify Environment Variables)
const token = process.env.BOT_TOKEN; 
const bot = new TelegramBot(token);

// Header API Siputzx
const headers = {
    'accept': '*/*',
    'User-Agent': 'PostmanRuntime/7.26.8'
};

exports.handler = async (event) => {
    // Hanya proses method POST dari Telegram
    if (event.httpMethod !== "POST") {
        return { statusCode: 200, body: "Bot is running" };
    }

    try {
        const body = JSON.parse(event.body);

        // --- LOGIKA BOT DI SINI ---
        
        // 1. Handle Callback Query (Saat tombol ditekan)
        if (body.callback_query) {
            const callback = body.callback_query;
            const chatId = callback.message.chat.id;
            const data = callback.data;
            const messageId = callback.message.message_id;

            // A. Callback: Pilih Anime (Format: anime|url)
            if (data.startsWith('anime|')) {
                const url = data.split('|')[1];
                await bot.sendMessage(chatId, "⏳ *Mengambil detail anime...*", { parse_mode: 'Markdown' });
                
                try {
                    const res = await axios.get(`https://api.siputzx.my.id/api/anime/otakudesu/detail?url=${encodeURIComponent(url)}`, { headers });
                    if (res.data.status) {
                        const info = res.data.data.animeInfo;
                        const episodes = res.data.data.episodes;

                        let caption = `🎬 *${info.title}*\n\n`;
                        caption += `⭐ Skor: ${info.score}\n`;
                        caption += `📅 Rilis: ${info.releaseDate}\n`;
                        caption += `🎭 Genre: ${info.genres}\n`;
                        caption += `📝 Status: ${info.status}\n\n`;
                        caption += `Silakan pilih episode di bawah:`;

                        // Buat tombol episode (Batasi 20 episode pertama agar tidak error limit telegram)
                        const episodeButtons = episodes.slice(0, 20).map(ep => {
                            // Extract nomor episode dari judul jika mungkin, atau gunakan index
                            return [{ text: ep.title, callback_data: `dl|${ep.link}` }];
                        });

                        await bot.sendPhoto(chatId, info.imageUrl, {
                            caption: caption,
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: episodeButtons }
                        });
                    }
                } catch (error) {
                    await bot.sendMessage(chatId, "❌ Gagal mengambil detail anime.");
                }
            }

            // B. Callback: Download Episode (Format: dl|url)
            else if (data.startsWith('dl|')) {
                const url = data.split('|')[1];
                await bot.sendMessage(chatId, "🔍 *Mencari link video...*", { parse_mode: 'Markdown' });

                try {
                    const res = await axios.get(`https://api.siputzx.my.id/api/anime/otakudesu/download?url=${encodeURIComponent(url)}`, { headers });
                    if (res.data.status) {
                        const downloads = res.data.data.downloads;
                        let msg = `📥 *Link Download*\n\n`;
                        
                        // Filter link (API ini memberikan safelink, bot tidak bisa kirim video langsung tanpa bypass safelink)
                        // Kita akan kirim linknya saja.
                        downloads.forEach(item => {
                            msg += `💿 *${item.quality}* (${item.host})\n🔗 [Klik Disini](${item.link})\n\n`;
                        });

                        msg += `_Catatan: API menggunakan safelink, silakan klik link untuk menuju video._`;

                        await bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', disable_web_page_preview: true });
                    } else {
                         await bot.sendMessage(chatId, "❌ Link download tidak ditemukan.");
                    }
                } catch (error) {
                    await bot.sendMessage(chatId, "❌ Gagal mengambil link download.");
                }
            }
            
            // Jawab callback agar loading di tombol hilang
            await bot.answerCallbackQuery(callback.id);
        }

        // 2. Handle Pesan Teks Biasa
        else if (body.message) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            if (!text) return { statusCode: 200 };

            // Command /start
            if (text === '/start') {
                await bot.sendMessage(chatId, 
                    "👋 Halo! Saya SBM Anime Bot.\n\n" +
                    "Gunakan perintah berikut:\n" +
                    "1. `/search nama_anime` - Cari anime\n" +
                    "2. `/ongoing` - Lihat anime sedang tayang", 
                    { parse_mode: 'Markdown' }
                );
            }

            // Command /ongoing
            else if (text === '/ongoing') {
                 await bot.sendMessage(chatId, "⏳ *Mengambil daftar ongoing...*", { parse_mode: 'Markdown' });
                 try {
                    const res = await axios.get('https://api.siputzx.my.id/api/anime/otakudesu/ongoing', { headers });
                    if (res.data.status) {
                        const list = res.data.data;
                        const keyboard = list.map(anime => {
                            return [{ text: `${anime.title} (Ep ${anime.episode})`, callback_data: `anime|${anime.link}` }];
                        });
                        
                        await bot.sendMessage(chatId, "🔥 *Anime Sedang Tayang:*", {
                            parse_mode: 'Markdown',
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    }
                 } catch (e) {
                     await bot.sendMessage(chatId, "❌ Gagal mengambil data ongoing.");
                 }
            }

            // Command /search
            else if (text.startsWith('/search')) {
                const query = text.split(' ').slice(1).join(' ');
                if (!query) {
                    return bot.sendMessage(chatId, "⚠️ Gunakan format: `/search naruto`", { parse_mode: 'Markdown' });
                }

                await bot.sendMessage(chatId, `🔍 *Mencari: ${query}...*`, { parse_mode: 'Markdown' });

                try {
                    const res = await axios.get(`https://api.siputzx.my.id/api/anime/otakudesu/search?s=${encodeURIComponent(query)}`, { headers });
                    if (res.data.status && res.data.data.length > 0) {
                        const results = res.data.data;
                        const keyboard = results.map(anime => {
                            return [{ text: `${anime.title} (${anime.status})`, callback_data: `anime|${anime.link}` }];
                        });

                        await bot.sendMessage(chatId, `✅ Ditemukan ${results.length} anime:`, {
                            reply_markup: { inline_keyboard: keyboard }
                        });
                    } else {
                        await bot.sendMessage(chatId, "❌ Anime tidak ditemukan.");
                    }
                } catch (error) {
                    await bot.sendMessage(chatId, "❌ Terjadi kesalahan saat mencari.");
                }
            }
        }

    } catch (e) {
        console.error(e);
    }

    return { statusCode: 200, body: "OK" };
};
