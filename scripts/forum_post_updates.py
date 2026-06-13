#!/usr/bin/env python3
"""Post build-in-public updates to forum threads via Chrome CDP."""

import json
import time
import sys
import base64
import websocket
import urllib.request

CHROME_HOST = "localhost"
CHROME_PORT = 9222

USERNAME = "tikitaka_vip"
PASSWORD = "TK!v1p_2026WC#secure"


def create_tab():
    """Create a new Chrome tab and return (ws_url, tab_id)."""
    req = urllib.request.Request(
        f"http://{CHROME_HOST}:{CHROME_PORT}/json/new?about:blank",
        method="PUT"
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    return data["webSocketDebuggerUrl"], data["id"]


def close_tab(tab_id):
    try:
        req = urllib.request.Request(
            f"http://{CHROME_HOST}:{CHROME_PORT}/json/close/{tab_id}",
            method="PUT"
        )
        urllib.request.urlopen(req)
    except:
        pass


def send_cmd(ws, method, params=None, timeout=30):
    msg_id = int(time.time() * 1000000) % 10000000
    cmd = {"id": msg_id, "method": method}
    if params:
        cmd["params"] = params
    ws.send(json.dumps(cmd))

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            ws.settimeout(min(5, deadline - time.time()))
            resp = json.loads(ws.recv())
            if resp.get("id") == msg_id:
                if "error" in resp:
                    print(f"  CDP error: {resp['error'].get('message','')}", file=sys.stderr)
                return resp.get("result", {})
        except websocket.WebSocketTimeoutException:
            continue
    return {}


def wait_for_load(ws, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            ws.settimeout(2)
            msg = json.loads(ws.recv())
            if msg.get("method") == "Page.loadEventFired":
                return True
            if msg.get("method") == "Page.frameStoppedLoading":
                return True
        except websocket.WebSocketTimeoutException:
            continue
    return False


def drain_messages(ws, seconds=1):
    """Drain any pending messages."""
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            ws.settimeout(0.3)
            ws.recv()
        except:
            break


def evaluate(ws, expression, timeout=15):
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True
    }, timeout=timeout)
    val = result.get("result", {})
    if val.get("type") == "undefined":
        return None
    return val.get("value")


def screenshot(ws, path):
    result = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
    if result.get("data"):
        with open(path, "wb") as f:
            f.write(base64.b64decode(result["data"]))
        print(f"  Screenshot: {path}")


def navigate(ws, url, wait=3):
    send_cmd(ws, "Page.navigate", {"url": url})
    wait_for_load(ws)
    time.sleep(wait)
    drain_messages(ws)


# ============================================================
# XTRATIME
# ============================================================
def post_xtratime():
    print("\n=== XTRATIME ===")
    ws_url, tab_id = create_tab()
    ws = websocket.create_connection(ws_url, timeout=30)
    send_cmd(ws, "Page.enable")
    send_cmd(ws, "Runtime.enable")

    # First navigate to xtratime homepage to check if it redirects
    print("Navigating to xtratime.org...")
    navigate(ws, "https://www.xtratime.org/", wait=5)

    actual_url = evaluate(ws, "window.location.href")
    print(f"  Actual URL: {actual_url}")
    screenshot(ws, "/tmp/xtratime_home.png")

    # Check if we're on xtratime or got redirected
    if "xtratime.org" not in (actual_url or ""):
        print("  xtratime.org redirected elsewhere, trying direct thread URL...")

    # Try navigating to the thread directly
    thread_url = "https://www.xtratime.org/threads/we-built-a-free-world-cup-prediction-game-%E2%80%94-with-a-monkey-that-watches-real-zoo-webcams.495370/"
    print(f"Navigating to thread: {thread_url}")
    navigate(ws, thread_url, wait=5)

    actual_url = evaluate(ws, "window.location.href")
    title = evaluate(ws, "document.title")
    print(f"  URL: {actual_url}")
    print(f"  Title: {title}")
    screenshot(ws, "/tmp/xtratime_thread.png")

    # Check if we need to log in on xtratime specifically
    is_xtratime = "xtratime" in (actual_url or "")
    logged_in = evaluate(ws, """
        !!document.querySelector('.p-navgroup--member') ||
        !!document.querySelector('a[href*="/account"]') ||
        !!document.querySelector('.avatar--xxs')
    """)
    print(f"  On xtratime: {is_xtratime}, Logged in: {logged_in}")

    if not logged_in:
        # Determine login URL based on where we are
        if is_xtratime:
            login_url = "https://www.xtratime.org/login/"
        else:
            # We're on bigsoccer or similar - figure out the base URL
            base = evaluate(ws, "window.location.origin")
            login_url = f"{base}/login/"

        print(f"  Logging in at {login_url}...")
        navigate(ws, login_url, wait=3)
        screenshot(ws, "/tmp/xtratime_login_page.png")

        # Fill login form (XenForo style)
        evaluate(ws, """
            var loginField = document.querySelector('input[name="login"]');
            if (loginField) { loginField.focus(); loginField.value = ''; }
        """)
        time.sleep(0.3)
        send_cmd(ws, "Input.insertText", {"text": USERNAME})
        time.sleep(0.3)

        evaluate(ws, """
            var passField = document.querySelector('input[name="password"]');
            if (passField) { passField.focus(); passField.value = ''; }
        """)
        time.sleep(0.3)
        send_cmd(ws, "Input.insertText", {"text": PASSWORD})
        time.sleep(0.3)

        # Submit
        evaluate(ws, """
            var btn = document.querySelector('button.button--primary[type="submit"]') ||
                      document.querySelector('.button--primary');
            if (btn) btn.click();
        """)
        time.sleep(5)
        drain_messages(ws)

        logged_in = evaluate(ws, """
            !!document.querySelector('.p-navgroup--member') ||
            !!document.querySelector('a[href*="/account"]') ||
            !!document.querySelector('.avatar--xxs')
        """)
        print(f"  Login result: {logged_in}")
        screenshot(ws, "/tmp/xtratime_after_login.png")

        if not logged_in:
            error = evaluate(ws, "document.querySelector('.blockMessage--error')?.textContent?.trim() || ''")
            print(f"  Login error: {error}")
            close_tab(tab_id)
            ws.close()
            return False

        # Navigate back to thread
        print("  Navigating back to thread...")
        navigate(ws, thread_url, wait=5)
        actual_url = evaluate(ws, "window.location.href")
        print(f"  URL: {actual_url}")

    # Now try to post reply
    # Scroll to bottom
    evaluate(ws, "window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(2)

    screenshot(ws, "/tmp/xtratime_bottom.png")

    # Find and activate editor
    editor_type = evaluate(ws, """
        (function() {
            if (document.querySelector('.fr-element.fr-view')) return 'froala';
            if (document.querySelector('textarea[name="message"]')) return 'textarea';
            if (document.querySelector('.js-editor')) return 'js-editor-inactive';
            if (document.querySelector('[contenteditable="true"]')) return 'contenteditable';
            return 'none';
        })()
    """)
    print(f"  Editor type: {editor_type}")

    if editor_type == 'js-editor-inactive':
        # Click to activate
        evaluate(ws, """
            var e = document.querySelector('.js-editor');
            if (e) {
                var inner = e.querySelector('.fr-wrapper') || e.querySelector('.fr-box') || e;
                inner.click();
            }
        """)
        time.sleep(2)
        editor_type = evaluate(ws, """
            (function() {
                if (document.querySelector('.fr-element.fr-view')) return 'froala';
                if (document.querySelector('textarea[name="message"]')) return 'textarea';
                return 'none';
            })()
        """)
        print(f"  Editor after activation: {editor_type}")

    reply_text = """Quick update for anyone following this — the World Cup kicks off in just 6 days!

We've been heads down building and wanted to share what's new:

- Full onboarding flow so you can jump in and start predicting in under a minute
- Points breakdown page so you can see exactly how scoring works
- Dark mode and light mode
- Confetti when you nail an exact score prediction
- Shareable prediction cards you can post to social media

Everything is still 100% free. If you haven't tried it yet, now's the time — predictions lock once each match starts.

https://tikitaka.vip

Would love to hear what you think. Any feature requests welcome too."""

    if editor_type == 'froala':
        evaluate(ws, """
            var el = document.querySelector('.fr-element.fr-view');
            el.click(); el.focus();
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": reply_text})
    elif editor_type == 'textarea':
        evaluate(ws, """
            var ta = document.querySelector('textarea[name="message"]');
            ta.click(); ta.focus(); ta.value = '';
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": reply_text})
    else:
        print("  ERROR: No editor found!")
        screenshot(ws, "/tmp/xtratime_no_editor.png")
        close_tab(tab_id)
        ws.close()
        return False

    time.sleep(1)

    # Verify content
    content = evaluate(ws, """
        (function() {
            var f = document.querySelector('.fr-element.fr-view');
            if (f) return f.textContent.substring(0, 80);
            var ta = document.querySelector('textarea[name="message"]');
            if (ta) return ta.value.substring(0, 80);
            return '';
        })()
    """)
    print(f"  Content preview: {content}")

    if not content or len(str(content)) < 10:
        print("  ERROR: Text not entered properly")
        screenshot(ws, "/tmp/xtratime_text_fail.png")
        close_tab(tab_id)
        ws.close()
        return False

    screenshot(ws, "/tmp/xtratime_before_submit.png")

    # Submit
    evaluate(ws, """
        var btn = document.querySelector('.js-replyNewMessageContainer button.button--primary[type="submit"]') ||
                  document.querySelector('button.button--primary[type="submit"]') ||
                  Array.from(document.querySelectorAll('button')).find(b =>
                    b.textContent.trim().toLowerCase().includes('post reply'));
        if (btn) btn.click();
    """)
    print("  Clicked submit...")
    time.sleep(6)
    drain_messages(ws)

    new_url = evaluate(ws, "window.location.href")
    print(f"  After submit URL: {new_url}")
    screenshot(ws, "/tmp/xtratime_after_submit.png")

    error = evaluate(ws, """
        (document.querySelector('.blockMessage--error')?.textContent?.trim()) || ''
    """)
    if error:
        print(f"  Error: {error}")
        close_tab(tab_id)
        ws.close()
        return False

    print("  XTRATIME: Reply posted!")
    close_tab(tab_id)
    ws.close()
    return True


# ============================================================
# FORUMFOOT (French)
# ============================================================
def post_forumfoot():
    print("\n=== FORUMFOOT ===")
    ws_url, tab_id = create_tab()
    ws = websocket.create_connection(ws_url, timeout=30)
    send_cmd(ws, "Page.enable")
    send_cmd(ws, "Runtime.enable")

    thread_url = "https://forumfoot.forumactif.com/t706-coupe-du-monde-2026-vos-pronostics"

    # Navigate to thread
    print("Navigating to forumfoot thread...")
    navigate(ws, thread_url, wait=5)

    actual_url = evaluate(ws, "window.location.href")
    title = evaluate(ws, "document.title")
    print(f"  URL: {actual_url}")
    print(f"  Title: {title}")
    screenshot(ws, "/tmp/forumfoot_thread.png")

    # Check if logged in (forumactif style)
    logged_in = evaluate(ws, """
        !!document.querySelector('a[href*="/profile"]') ||
        !!document.querySelector('.i_icon_logout') ||
        !!document.querySelector('#logout') ||
        !!document.querySelector('a[href*="logout"]') ||
        document.body.innerHTML.includes('Déconnexion') ||
        document.body.innerHTML.includes('deconnexion')
    """)
    print(f"  Logged in: {logged_in}")

    if not logged_in:
        print("  Need to log in...")
        # forumactif typically has login at /login
        navigate(ws, "https://forumfoot.forumactif.com/login", wait=3)
        screenshot(ws, "/tmp/forumfoot_login.png")

        # Fill login - forumactif uses username/password fields
        # Check field names
        fields = evaluate(ws, """
            JSON.stringify(
                Array.from(document.querySelectorAll('input')).map(i => ({
                    name: i.name, type: i.type, id: i.id, placeholder: i.placeholder
                })).filter(i => i.type !== 'hidden')
            )
        """)
        print(f"  Login fields: {fields}")

        # Try typical forumactif login
        evaluate(ws, """
            var user = document.querySelector('input[name="username"]') ||
                       document.querySelector('#username');
            if (user) { user.focus(); user.value = ''; }
        """)
        time.sleep(0.3)
        send_cmd(ws, "Input.insertText", {"text": USERNAME})
        time.sleep(0.3)

        evaluate(ws, """
            var pass = document.querySelector('input[name="password"]') ||
                       document.querySelector('#password');
            if (pass) { pass.focus(); pass.value = ''; }
        """)
        time.sleep(0.3)
        send_cmd(ws, "Input.insertText", {"text": PASSWORD})
        time.sleep(0.3)

        # Check for "remember me" and submit
        evaluate(ws, """
            var auto = document.querySelector('input[name="autologin"]');
            if (auto && !auto.checked) auto.click();
            var btn = document.querySelector('input[type="submit"]') ||
                      document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        """)
        time.sleep(5)
        drain_messages(ws)

        actual_url = evaluate(ws, "window.location.href")
        print(f"  After login URL: {actual_url}")
        screenshot(ws, "/tmp/forumfoot_after_login.png")

        # Navigate back to thread
        navigate(ws, thread_url, wait=5)

    # Look for reply button or reply form
    # forumactif typically has "Répondre" button
    screenshot(ws, "/tmp/forumfoot_thread2.png")

    # Scroll to bottom
    evaluate(ws, "window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(2)

    # Check for reply form
    reply_info = evaluate(ws, """
        JSON.stringify({
            hasReplyBtn: !!document.querySelector('a[href*="reply"]'),
            hasTextarea: !!document.querySelector('textarea'),
            hasEditor: !!document.querySelector('.sceditor-container') || !!document.querySelector('#text_editor_textarea'),
            hasPostReply: !!Array.from(document.querySelectorAll('a')).find(a =>
                a.textContent.includes('Répondre') || a.textContent.includes('Reply')),
            replyLinks: Array.from(document.querySelectorAll('a')).filter(a =>
                a.href && a.href.includes('reply')).map(a => a.href).slice(0, 3)
        })
    """)
    print(f"  Reply info: {reply_info}")
    screenshot(ws, "/tmp/forumfoot_bottom.png")

    reply_text_fr = """Petit update pour ceux qui suivent — la Coupe du Monde commence dans 6 jours !

On a bien bossé côté développement, voici les nouveautés :

- Un parcours d'inscription simplifié pour commencer à pronostiquer en moins d'une minute
- Une page détaillée du système de points
- Mode sombre et mode clair
- Des confettis quand vous tombez sur le score exact
- Des cartes de pronostics partageables sur les réseaux

Le jeu est toujours 100% gratuit. Si vous n'avez pas encore essayé, c'est le moment — les pronostics sont verrouillés une fois que chaque match commence.

https://tikitaka.vip

N'hésitez pas à me faire vos retours ou suggestions !"""

    # Try to find and use the reply mechanism
    # forumactif forums often have a quick reply at the bottom or a reply link
    has_quick_reply = evaluate(ws, """
        !!document.querySelector('#quick_reply') ||
        !!document.querySelector('.quick-reply') ||
        !!document.querySelector('textarea[name="message"]') ||
        !!document.querySelector('#text_editor_textarea')
    """)
    print(f"  Quick reply form: {has_quick_reply}")

    if has_quick_reply:
        # Focus and type in quick reply
        evaluate(ws, """
            var ta = document.querySelector('textarea[name="message"]') ||
                     document.querySelector('#text_editor_textarea');
            if (ta) { ta.scrollIntoView(); ta.click(); ta.focus(); ta.value = ''; }
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": reply_text_fr})
        time.sleep(1)

        # Submit
        evaluate(ws, """
            var btn = document.querySelector('input[name="post"]') ||
                      document.querySelector('button[type="submit"]') ||
                      document.querySelector('input[type="submit"]');
            if (btn) btn.click();
        """)
        time.sleep(5)
        drain_messages(ws)
    else:
        # Need to click reply link first
        reply_data = json.loads(reply_info) if isinstance(reply_info, str) else {}
        reply_links = reply_data.get("replyLinks", [])

        if reply_links:
            print(f"  Navigating to reply page: {reply_links[0]}")
            navigate(ws, reply_links[0], wait=5)
        else:
            # Try finding reply button by text
            clicked = evaluate(ws, """
                var links = Array.from(document.querySelectorAll('a, img'));
                var reply = links.find(a =>
                    (a.textContent && (a.textContent.includes('Répondre') || a.textContent.includes('Reply'))) ||
                    (a.alt && (a.alt.includes('Répondre') || a.alt.includes('Reply'))) ||
                    (a.title && (a.title.includes('Répondre') || a.title.includes('Reply')))
                );
                if (reply) { reply.click(); true; } else { false; }
            """)
            print(f"  Clicked reply link: {clicked}")
            time.sleep(5)
            drain_messages(ws)

        screenshot(ws, "/tmp/forumfoot_reply_page.png")

        # Now look for textarea on reply page
        evaluate(ws, """
            var ta = document.querySelector('textarea[name="message"]') ||
                     document.querySelector('#text_editor_textarea') ||
                     document.querySelector('textarea');
            if (ta) { ta.scrollIntoView(); ta.click(); ta.focus(); ta.value = ''; }
        """)
        time.sleep(0.5)

        # Check for sceditor (common in forumactif)
        has_sceditor = evaluate(ws, "!!document.querySelector('.sceditor-container')")
        if has_sceditor:
            # sceditor uses an iframe
            evaluate(ws, """
                var iframe = document.querySelector('.sceditor-container iframe');
                if (iframe) {
                    var body = iframe.contentDocument.body;
                    body.click();
                    body.focus();
                }
            """)
            time.sleep(0.5)
            send_cmd(ws, "Input.insertText", {"text": reply_text_fr})
        else:
            send_cmd(ws, "Input.insertText", {"text": reply_text_fr})

        time.sleep(1)

        # Submit
        evaluate(ws, """
            var btn = document.querySelector('input[name="post"]') ||
                      document.querySelector('button[name="post"]') ||
                      document.querySelector('input[type="submit"][value*="Envoyer"]') ||
                      document.querySelector('input[type="submit"][value*="Send"]') ||
                      document.querySelector('input[type="submit"]') ||
                      document.querySelector('button[type="submit"]');
            if (btn) btn.click();
        """)
        time.sleep(5)
        drain_messages(ws)

    new_url = evaluate(ws, "window.location.href")
    print(f"  After submit URL: {new_url}")
    screenshot(ws, "/tmp/forumfoot_after_submit.png")

    error = evaluate(ws, """
        var err = document.querySelector('.error') || document.querySelector('.message-error');
        err ? err.textContent.trim() : ''
    """)
    if error:
        print(f"  Error: {error}")

    print("  FORUMFOOT: Done")
    close_tab(tab_id)
    ws.close()
    return True


if __name__ == "__main__":
    results = {}
    results["xtratime"] = post_xtratime()
    results["forumfoot"] = post_forumfoot()
    print(f"\n=== RESULTS ===")
    for k, v in results.items():
        print(f"  {k}: {'SUCCESS' if v else 'FAILED'}")
