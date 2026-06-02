const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ZOHO_ACCOUNT_ID = '5468118000000008002';
const ZOHO_CLIENT_ID = '1000.WKUAFIFWPOENK8KRGQMLD1RIODZ50R';
const ZOHO_CLIENT_SECRET = '26620d2b161de7fc0369c5cac9ddde4968fc52af02';
const ZOHO_REFRESH_TOKEN = '1000.fc54c33e340c522c79d635ac704af6de.848b75f86051a382093cc51001fbd8e3';
let accessToken = null;
let tokenExpiry = 0;

const TG_BOT_TOKEN = '8445371320:AAE4YLFNtHH8jZx_NJgxbep9C0E7Z8RwP1c';
const TG_CHAT_ID = '6674342664';

const DAILY_LIMIT = 500;
const ALERT_THRESHOLD = 400;
const counterFile = path.join(__dirname, '.email-counter.json');

const RTL_LANGS = new Set(['he', 'ar']);

const EMAIL_STRINGS = {
  he: {
    welcome_subject: '🐒 הצטרפת למשחק ניחושים נגד קוף אמיתי',
    welcome_title: '!ברוכים הבאים ל-TikiTaka.vip',
    welcome_hook: 'הצטרפת למשחק ניחושים נגד קוף אמיתי מגן החיות. עכשיו תהפכו את זה למעניין.',
    welcome_group_title: '👥 צרו קבוצה, הזמינו חברים, המפסיד מביא בירות',
    welcome_group_body: 'המשחק פי 10 יותר כיף עם חברים. בלי קבוצה — אתם סתם מנחשים לבד. עם חברים — כל משחק הופך לקרב.',
    welcome_leaderboard_you: 'אתה',
    welcome_leaderboard_monkey: 'הקוף 🐒',
    welcome_leaderboard_friend: 'החבר שלך',
    welcome_cta: 'צור קבוצה והזמן חברים',
    welcome_cta2: 'או התחילו לנחש עכשיו',
    welcome_share: 'שלחו את הלינק הזה לחברים כדי שיצטרפו לקבוצה שלכם:',
    welcome_beer: 'מי שמפסיד לקוף מביא בירות 🍺',
    welcome_footer: 'tikitaka.vip — ניחושים למונדיאל 2026',
    reset_subject: '🔑 איפוס סיסמה — TikiTaka',
    reset_title: 'איפוס סיסמה',
    reset_body: 'קיבלנו בקשה לאיפוס הסיסמה שלך. לחצו על הכפתור למטה:',
    reset_cta: 'איפוס סיסמה',
    reset_expires: 'הקישור תקף לשעה אחת בלבד.',
    reset_ignore: 'אם לא ביקשת איפוס, התעלם מהמייל הזה.',
    verify_subject: '✉️ אימות מייל — TikiTaka',
    verify_title: 'אימות כתובת מייל',
    verify_body: 'תודה שנרשמת! לחצו על הכפתור כדי לאמת את המייל:',
    verify_cta: 'אימות מייל',
  },
  en: {
    welcome_subject: '🐒 You just joined a prediction game against a real monkey',
    welcome_title: 'Welcome to TikiTaka.vip!',
    welcome_hook: "You just joined a prediction game against a real monkey. Now make it interesting.",
    welcome_group_title: '👥 Create a group, invite friends, loser buys beers',
    welcome_group_body: "The game is 10x better with a group. Without friends, you're just guessing alone. With friends, every match becomes a fight.",
    welcome_leaderboard_you: 'You',
    welcome_leaderboard_monkey: 'The Monkey 🐒',
    welcome_leaderboard_friend: 'Your friend',
    welcome_cta: 'Create a Group & Invite Friends',
    welcome_cta2: 'Or start predicting now',
    welcome_share: 'Send this link to friends to join your group:',
    welcome_beer: 'Whoever loses to the monkey buys beers 🍺',
    welcome_footer: 'tikitaka.vip — World Cup 2026 Predictions',
    reset_subject: '🔑 Password Reset — TikiTaka',
    reset_title: 'Password Reset',
    reset_body: 'We received a request to reset your password. Click below:',
    reset_cta: 'Reset Password',
    reset_expires: 'This link is valid for 1 hour.',
    reset_ignore: "If you didn't request this, just ignore this email.",
    verify_subject: '✉️ Verify Email — TikiTaka',
    verify_title: 'Verify Your Email',
    verify_body: 'Thanks for signing up! Click the button to verify your email:',
    verify_cta: 'Verify Email',
  },
  es: {
    welcome_subject: '🐒 Te uniste a un juego de predicciones contra un mono real',
    welcome_title: '¡Bienvenido a TikiTaka.vip!',
    welcome_hook: 'Te uniste a un juego de predicciones contra un mono real del zoo. Ahora hagámoslo interesante.',
    welcome_group_title: '👥 Crea un grupo, invita amigos, el perdedor paga las cervezas',
    welcome_group_body: 'El juego es 10 veces mejor con amigos. Sin grupo, solo adivinas solo. Con amigos, cada partido es una batalla.',
    welcome_leaderboard_you: 'Tú',
    welcome_leaderboard_monkey: 'El Mono 🐒',
    welcome_leaderboard_friend: 'Tu amigo',
    welcome_cta: 'Crear grupo e invitar amigos',
    welcome_cta2: 'O empieza a predecir ahora',
    welcome_share: 'Envía este enlace a tus amigos para unirse a tu grupo:',
    welcome_beer: 'El que pierda contra el mono paga las cervezas 🍺',
    welcome_footer: 'tikitaka.vip — Predicciones del Mundial 2026',
    reset_subject: '🔑 Restablecer contraseña — TikiTaka',
    reset_title: 'Restablecer contraseña',
    reset_body: 'Recibimos una solicitud para restablecer tu contraseña:',
    reset_cta: 'Restablecer contraseña',
    reset_expires: 'Este enlace es válido por 1 hora.',
    reset_ignore: 'Si no solicitaste esto, ignora este correo.',
    verify_subject: '✉️ Verificar correo — TikiTaka',
    verify_title: 'Verifica tu correo',
    verify_body: '¡Gracias por registrarte! Haz clic para verificar:',
    verify_cta: 'Verificar correo',
  },
  fr: {
    welcome_subject: '🐒 Tu viens de rejoindre un jeu de pronostics contre un vrai singe',
    welcome_title: 'Bienvenue sur TikiTaka.vip !',
    welcome_hook: 'Tu viens de rejoindre un jeu de pronostics contre un vrai singe du zoo. Maintenant, rendons ça intéressant.',
    welcome_group_title: '👥 Crée un groupe, invite tes amis, le perdant paie les bières',
    welcome_group_body: "Le jeu est 10 fois mieux avec des amis. Sans groupe, tu devines seul. Avec des amis, chaque match devient un combat.",
    welcome_leaderboard_you: 'Toi',
    welcome_leaderboard_monkey: 'Le Singe 🐒',
    welcome_leaderboard_friend: 'Ton ami',
    welcome_cta: 'Créer un groupe et inviter des amis',
    welcome_cta2: 'Ou commence à pronostiquer',
    welcome_share: 'Envoie ce lien à tes amis pour rejoindre ton groupe :',
    welcome_beer: 'Celui qui perd contre le singe paie les bières 🍺',
    welcome_footer: 'tikitaka.vip — Pronostics Coupe du Monde 2026',
    reset_subject: '🔑 Réinitialiser le mot de passe — TikiTaka',
    reset_title: 'Réinitialiser le mot de passe',
    reset_body: 'Nous avons reçu une demande de réinitialisation :',
    reset_cta: 'Réinitialiser',
    reset_expires: 'Ce lien est valable 1 heure.',
    reset_ignore: "Si vous n'avez pas fait cette demande, ignorez cet email.",
    verify_subject: '✉️ Vérifier l\'email — TikiTaka',
    verify_title: 'Vérifiez votre email',
    verify_body: 'Merci de vous être inscrit ! Cliquez pour vérifier :',
    verify_cta: 'Vérifier',
  },
  pt: {
    welcome_subject: '🐒 Você entrou num jogo de palpites contra um macaco de verdade',
    welcome_title: 'Bem-vindo ao TikiTaka.vip!',
    welcome_hook: 'Você entrou num jogo de palpites contra um macaco de verdade do zoológico. Agora vamos deixar interessante.',
    welcome_group_title: '👥 Crie um grupo, convide amigos, quem perder paga as cervejas',
    welcome_group_body: 'O jogo é 10 vezes melhor com amigos. Sem grupo, você só adivinha sozinho. Com amigos, cada jogo vira uma batalha.',
    welcome_leaderboard_you: 'Você',
    welcome_leaderboard_monkey: 'O Macaco 🐒',
    welcome_leaderboard_friend: 'Seu amigo',
    welcome_cta: 'Criar grupo e convidar amigos',
    welcome_cta2: 'Ou comece a apostar agora',
    welcome_share: 'Envie este link para amigos entrarem no seu grupo:',
    welcome_beer: 'Quem perder pro macaco paga as cervejas 🍺',
    welcome_footer: 'tikitaka.vip — Palpites Copa do Mundo 2026',
    reset_subject: '🔑 Redefinir senha — TikiTaka',
    reset_title: 'Redefinir senha',
    reset_body: 'Recebemos um pedido para redefinir sua senha:',
    reset_cta: 'Redefinir senha',
    reset_expires: 'Este link é válido por 1 hora.',
    reset_ignore: 'Se não foi você, ignore este email.',
    verify_subject: '✉️ Verificar email — TikiTaka',
    verify_title: 'Verifique seu email',
    verify_body: 'Obrigado por se cadastrar! Clique para verificar:',
    verify_cta: 'Verificar',
  },
  ar: {
    welcome_subject: '🐒 انضممت للعبة توقعات ضد قرد حقيقي',
    welcome_title: '!مرحباً بك في TikiTaka.vip',
    welcome_hook: 'انضممت للعبة توقعات ضد قرد حقيقي من حديقة الحيوان. الآن خلّيها مثيرة.',
    welcome_group_title: '👥 أنشئ مجموعة، ادعُ أصدقاءك، الخاسر يشتري البيرة',
    welcome_group_body: 'اللعبة أحلى 10 مرات مع أصدقاء. بدون مجموعة — أنت تخمن وحدك. مع أصدقاء — كل مباراة تصير معركة.',
    welcome_leaderboard_you: 'أنت',
    welcome_leaderboard_monkey: 'القرد 🐒',
    welcome_leaderboard_friend: 'صديقك',
    welcome_cta: 'أنشئ مجموعة وادعُ أصدقاء',
    welcome_cta2: 'أو ابدأ التوقع الآن',
    welcome_share: ':أرسل هذا الرابط لأصدقائك للانضمام لمجموعتك',
    welcome_beer: 'اللي يخسر من القرد يجيب البيرة 🍺',
    welcome_footer: 'tikitaka.vip — توقعات كأس العالم 2026',
    reset_subject: '🔑 إعادة تعيين كلمة المرور — TikiTaka',
    reset_title: 'إعادة تعيين كلمة المرور',
    reset_body: 'تلقينا طلباً لإعادة تعيين كلمة المرور:',
    reset_cta: 'إعادة التعيين',
    reset_expires: 'هذا الرابط صالح لمدة ساعة واحدة.',
    reset_ignore: 'إذا لم تطلب ذلك، تجاهل هذا البريد.',
    verify_subject: '✉️ تأكيد البريد — TikiTaka',
    verify_title: 'تأكيد البريد الإلكتروني',
    verify_body: 'شكراً للتسجيل! اضغط لتأكيد بريدك:',
    verify_cta: 'تأكيد',
  },
  ru: {
    welcome_subject: '🐒 Ты присоединился к игре прогнозов против настоящей обезьяны',
    welcome_title: 'Добро пожаловать в TikiTaka.vip!',
    welcome_hook: 'Ты присоединился к игре прогнозов против настоящей обезьяны из зоопарка. Теперь сделай это интересным.',
    welcome_group_title: '👥 Создай группу, позови друзей, проигравший покупает пиво',
    welcome_group_body: 'Игра в 10 раз лучше с друзьями. Без группы — ты просто угадываешь один. С друзьями — каждый матч становится битвой.',
    welcome_leaderboard_you: 'Ты',
    welcome_leaderboard_monkey: 'Обезьяна 🐒',
    welcome_leaderboard_friend: 'Твой друг',
    welcome_cta: 'Создать группу и позвать друзей',
    welcome_cta2: 'Или начни прогнозировать',
    welcome_share: 'Отправь эту ссылку друзьям, чтобы они присоединились к твоей группе:',
    welcome_beer: 'Кто проиграет обезьяне — покупает пиво 🍺',
    welcome_footer: 'tikitaka.vip — Прогнозы ЧМ 2026',
    reset_subject: '🔑 Сброс пароля — TikiTaka',
    reset_title: 'Сброс пароля',
    reset_body: 'Мы получили запрос на сброс пароля:',
    reset_cta: 'Сбросить пароль',
    reset_expires: 'Ссылка действительна 1 час.',
    reset_ignore: 'Если это не вы, проигнорируйте письмо.',
    verify_subject: '✉️ Подтверждение email — TikiTaka',
    verify_title: 'Подтвердите email',
    verify_body: 'Спасибо за регистрацию! Нажмите для подтверждения:',
    verify_cta: 'Подтвердить',
  },
  de: {
    welcome_subject: '🐒 Du bist einem Tippspiel gegen einen echten Affen beigetreten',
    welcome_title: 'Willkommen bei TikiTaka.vip!',
    welcome_hook: 'Du bist einem Tippspiel gegen einen echten Zoo-Affen beigetreten. Jetzt mach es spannend.',
    welcome_group_title: '👥 Erstelle eine Gruppe, lade Freunde ein, der Verlierer zahlt die Biere',
    welcome_group_body: 'Das Spiel ist 10x besser mit Freunden. Ohne Gruppe tippst du allein. Mit Freunden wird jedes Spiel zum Kampf.',
    welcome_leaderboard_you: 'Du',
    welcome_leaderboard_monkey: 'Der Affe 🐒',
    welcome_leaderboard_friend: 'Dein Freund',
    welcome_cta: 'Gruppe erstellen & Freunde einladen',
    welcome_cta2: 'Oder fang an zu tippen',
    welcome_share: 'Schick diesen Link an Freunde, damit sie deiner Gruppe beitreten:',
    welcome_beer: 'Wer gegen den Affen verliert, zahlt die Biere 🍺',
    welcome_footer: 'tikitaka.vip — WM 2026 Tipps',
    reset_subject: '🔑 Passwort zurücksetzen — TikiTaka',
    reset_title: 'Passwort zurücksetzen',
    reset_body: 'Wir haben eine Anfrage zum Zurücksetzen erhalten:',
    reset_cta: 'Zurücksetzen',
    reset_expires: 'Dieser Link ist 1 Stunde gültig.',
    reset_ignore: 'Falls du das nicht warst, ignoriere diese E-Mail.',
    verify_subject: '✉️ E-Mail bestätigen — TikiTaka',
    verify_title: 'E-Mail bestätigen',
    verify_body: 'Danke für die Registrierung! Klicke zur Bestätigung:',
    verify_cta: 'Bestätigen',
  },
  ja: {
    welcome_subject: '🐒 本物のサルとの予想対決に参加しました',
    welcome_title: 'TikiTaka.vipへようこそ！',
    welcome_hook: '動物園の本物のサルとの予想対決に参加しました。さあ、面白くしましょう。',
    welcome_group_title: '👥 グループを作って友達を招待、負けたらビールおごり',
    welcome_group_body: '友達がいると10倍楽しい。一人で予想するだけじゃつまらない。友達がいれば、毎試合が勝負になる。',
    welcome_leaderboard_you: 'あなた',
    welcome_leaderboard_monkey: 'サル 🐒',
    welcome_leaderboard_friend: '友達',
    welcome_cta: 'グループを作って友達を招待',
    welcome_cta2: 'または予想を始める',
    welcome_share: '友達にこのリンクを送ってグループに参加してもらおう:',
    welcome_beer: 'サルに負けたらビールおごり 🍺',
    welcome_footer: 'tikitaka.vip — W杯2026予想',
    reset_subject: '🔑 パスワードリセット — TikiTaka',
    reset_title: 'パスワードリセット',
    reset_body: 'パスワードリセットのリクエストを受け取りました：',
    reset_cta: 'リセット',
    reset_expires: 'このリンクは1時間有効です。',
    reset_ignore: 'リクエストしていない場合は無視してください。',
    verify_subject: '✉️ メール確認 — TikiTaka',
    verify_title: 'メールアドレスの確認',
    verify_body: '登録ありがとうございます！クリックして確認：',
    verify_cta: '確認',
  },
};

function s(lang, key) {
  return EMAIL_STRINGS[lang]?.[key] || EMAIL_STRINGS.en[key];
}

function loadCounter() {
  try {
    const data = JSON.parse(fs.readFileSync(counterFile, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    if (data.date === today) return data;
    return { date: today, sent: 0, alerted: false };
  } catch {
    return { date: new Date().toISOString().slice(0, 10), sent: 0, alerted: false };
  }
}

function saveCounter(counter) {
  fs.writeFileSync(counterFile, JSON.stringify(counter));
}

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const proto = options.port === 443 || !options.port ? https : require('http');
    const req = proto.request(options, res => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function sendTelegramAlert(msg) {
  try {
    const body = JSON.stringify({ chat_id: TG_CHAT_ID, text: msg, parse_mode: 'HTML' });
    await httpRequest({
      hostname: 'api.telegram.org',
      path: `/bot${TG_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, body);
  } catch (e) {
    console.error('TG alert failed:', e.message);
  }
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token'
  });
  const body = params.toString();
  const res = await httpRequest({
    hostname: 'accounts.zoho.com',
    path: '/oauth/v2/token',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) }
  }, body);

  const data = JSON.parse(res.body);
  if (!data.access_token) throw new Error(`Zoho token refresh failed: ${res.body}`);
  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

async function sendEmail(to, subject, htmlBody) {
  const counter = loadCounter();

  if (counter.sent >= DAILY_LIMIT) {
    console.error(`Email blocked: daily limit ${DAILY_LIMIT} reached`);
    await sendTelegramAlert(`🚨 <b>tikitaka.vip email BLOCKED</b>\n\nDaily limit of ${DAILY_LIMIT} reached.\nSwitch to Resend or wait until tomorrow.\n\nBlocked email to: ${to}`);
    return false;
  }

  if (counter.sent >= ALERT_THRESHOLD && !counter.alerted) {
    counter.alerted = true;
    saveCounter(counter);
    await sendTelegramAlert(`⚠️ <b>tikitaka.vip email alert</b>\n\n${counter.sent}/${DAILY_LIMIT} emails sent today.\nApproaching daily Zoho limit.\nConsider adding Resend as fallback.`);
  }

  try {
    const token = await getAccessToken();
    const payload = JSON.stringify({
      fromAddress: 'monkey@tikitaka.vip',
      toAddress: to,
      subject,
      content: htmlBody
    });

    const res = await httpRequest({
      hostname: 'mail.zoho.com',
      path: `/api/accounts/${ZOHO_ACCOUNT_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, payload);

    if (res.status === 200) {
      counter.sent++;
      saveCounter(counter);
      return true;
    }

    console.error(`Zoho send failed (${res.status}):`, res.body);
    return false;
  } catch (e) {
    console.error('Email send error:', e.message);
    return false;
  }
}

function emailShell(lang, title, bodyHtml) {
  const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a23; color: #e0e0e0; padding: 32px; direction: ${dir};">
  <div style="max-width: 480px; margin: 0 auto; background: #1a1a3e; border-radius: 16px; padding: 32px; border: 1px solid #333366;">
    <div style="text-align: center; font-size: 48px; margin-bottom: 16px;">🐒⚽</div>
    <h1 style="text-align: center; color: #ffd700; margin: 0 0 8px;">${title}</h1>
    ${bodyHtml}
    <p style="color: #888; font-size: 13px; text-align: center; margin-top: 24px;">
      ${s(lang, 'welcome_footer')}
    </p>
  </div>
</body>
</html>`;
}

function ctaButton(lang, href, label) {
  return `<div style="text-align: center; margin: 24px 0;">
  <a href="${href}" style="display: inline-block; background: #ffd700; color: #0a0a23; font-weight: bold; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">${label}</a>
</div>`;
}

function welcomeEmailHtml(name, lang, playerId, inviteCode) {
  const shareLink = inviteCode ? `tikitaka.vip/join/${inviteCode}` : (playerId ? `tikitaka.vip?ref=${playerId}` : 'tikitaka.vip');
  const body = `
    <p style="font-size: 17px; line-height: 1.6; margin: 0 0 24px;">${s(lang, 'welcome_hook')}</p>

    <div style="background: #252550; border-radius: 12px; padding: 20px; margin: 0 0 20px; border: 1px solid #444488;">
      <h2 style="color: #ffd700; margin: 0 0 10px; font-size: 16px;">${s(lang, 'welcome_group_title')}</h2>
      <p style="color: #ccc; margin: 0 0 16px; line-height: 1.5;">${s(lang, 'welcome_group_body')}</p>

      <div style="background: #1a1a3e; border-radius: 8px; padding: 12px; margin: 0 0 16px; font-family: monospace;">
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #333;">
          <span style="color: #ffd700;">1.</span>
          <span style="color: #ffd700; flex: 1; padding: 0 8px;">${s(lang, 'welcome_leaderboard_monkey')}</span>
          <span style="color: #ffd700; font-weight: bold;">15 pts</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #333;">
          <span style="color: #4ecdc4;">2.</span>
          <span style="color: #4ecdc4; flex: 1; padding: 0 8px;">${name} (${s(lang, 'welcome_leaderboard_you')})</span>
          <span style="color: #4ecdc4; font-weight: bold;">12 pts</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 6px 0;">
          <span style="color: #888;">3.</span>
          <span style="color: #888; flex: 1; padding: 0 8px;">${s(lang, 'welcome_leaderboard_friend')}</span>
          <span style="color: #888; font-weight: bold;">8 pts</span>
        </div>
      </div>

      <p style="text-align: center; color: #ffd700; font-size: 14px; margin: 0 0 12px;">${s(lang, 'welcome_beer')}</p>
    </div>

    ${ctaButton(lang, inviteCode ? `https://tikitaka.vip/?tab=groups` : 'https://tikitaka.vip/?tab=groups', s(lang, 'welcome_cta'))}

    <div style="text-align: center; margin: 8px 0 20px;">
      <a href="https://tikitaka.vip" style="color: #4ecdc4; font-size: 14px;">${s(lang, 'welcome_cta2')}</a>
    </div>

    <div style="text-align: center; margin-top: 16px; padding: 12px; background: #252550; border-radius: 8px;">
      <p style="color: #888; font-size: 12px; margin: 0 0 4px;">${s(lang, 'welcome_share')}</p>
      <p style="color: #4ecdc4; font-size: 14px; margin: 0; font-weight: bold;">${shareLink}</p>
    </div>`;
  return emailShell(lang, s(lang, 'welcome_title'), body);
}

function resetEmailHtml(name, resetUrl, lang) {
  const body = `
    <p style="font-size: 18px;">${s(lang, 'welcome_greeting')} <strong>${name}</strong>,</p>
    <p>${s(lang, 'reset_body')}</p>
    ${ctaButton(lang, resetUrl, s(lang, 'reset_cta'))}
    <p style="color: #aaa; font-size: 13px;">${s(lang, 'reset_expires')}</p>
    <p style="color: #666; font-size: 12px;">${s(lang, 'reset_ignore')}</p>`;
  return emailShell(lang, s(lang, 'reset_title'), body);
}

function verifyEmailHtml(name, verifyUrl, lang) {
  const body = `
    <p style="font-size: 18px;">${s(lang, 'welcome_greeting')} <strong>${name}</strong>,</p>
    <p>${s(lang, 'verify_body')}</p>
    ${ctaButton(lang, verifyUrl, s(lang, 'verify_cta'))}`;
  return emailShell(lang, s(lang, 'verify_title'), body);
}

async function sendWelcomeEmail(email, name, lang = 'he', playerId = null, inviteCode = null) {
  return sendEmail(email, s(lang, 'welcome_subject'), welcomeEmailHtml(name, lang, playerId, inviteCode));
}

async function sendResetEmail(email, name, resetUrl, lang = 'he') {
  return sendEmail(email, s(lang, 'reset_subject'), resetEmailHtml(name, resetUrl, lang));
}

async function sendVerifyEmail(email, name, verifyUrl, lang = 'he') {
  return sendEmail(email, s(lang, 'verify_subject'), verifyEmailHtml(name, verifyUrl, lang));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

module.exports = {
  sendEmail, sendWelcomeEmail, sendResetEmail, sendVerifyEmail,
  sendTelegramAlert, hashPassword, verifyPassword
};
