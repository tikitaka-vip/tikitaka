#!/usr/bin/env python3
"""Post an update reply to the existing xtratime.org thread."""

import json
import time
import sys
import websocket

CHROME_HOST = "localhost"
CHROME_PORT = 9222

THREAD_URL = "https://www.xtratime.org/threads/we-built-a-free-world-cup-prediction-game-%E2%80%94-with-a-monkey-that-watches-real-zoo-webcams.495370/"

REPLY_TEXT = """Quick update for anyone following this — the World Cup kicks off in just 6 days!

We've been heads down building and wanted to share what's new:

- Full onboarding flow so you can jump in and start predicting in under a minute
- Points breakdown page so you can see exactly how scoring works
- Dark mode and light mode (finally)
- Confetti when you nail an exact score prediction
- Shareable prediction cards you can post to social media

Everything is still 100% free. If you haven't tried it yet, now's the time — predictions lock once each match starts.

https://tikitaka.vip

Would love to hear what you think. Any feature requests welcome too."""


def get_ws_url():
    """Get websocket URL for a new tab."""
    import urllib.request
    # Create new tab via PUT
    req = urllib.request.Request(
        f"http://{CHROME_HOST}:{CHROME_PORT}/json/new?about:blank",
        method="PUT"
    )
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    return data["webSocketDebuggerUrl"], data["id"]


def send_cmd(ws, method, params=None, timeout=30):
    """Send CDP command and wait for result."""
    msg_id = int(time.time() * 1000) % 1000000
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
                    print(f"  CDP error: {resp['error']}", file=sys.stderr)
                return resp.get("result", {})
        except websocket.WebSocketTimeoutException:
            continue
    print(f"  Timeout waiting for {method}", file=sys.stderr)
    return {}


def wait_for_load(ws, timeout=30):
    """Wait for page load."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            ws.settimeout(2)
            msg = json.loads(ws.recv())
            if msg.get("method") == "Page.loadEventFired":
                return True
        except websocket.WebSocketTimeoutException:
            continue
    return False


def evaluate(ws, expression, timeout=15):
    """Evaluate JS expression."""
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": expression,
        "returnByValue": True,
        "awaitPromise": True
    }, timeout=timeout)
    return result.get("result", {}).get("value")


def main():
    ws_url, tab_id = get_ws_url()
    print(f"Tab: {tab_id}")

    ws = websocket.create_connection(ws_url, timeout=30)
    send_cmd(ws, "Page.enable")
    send_cmd(ws, "Runtime.enable")

    # Navigate to thread
    print("Navigating to xtratime thread...")
    send_cmd(ws, "Page.navigate", {"url": THREAD_URL})
    wait_for_load(ws)
    time.sleep(3)

    # Check if we're logged in
    logged_in = evaluate(ws, """
        !!document.querySelector('.p-navgroup--member') ||
        !!document.querySelector('a[href*="account/"]')
    """)
    print(f"Logged in: {logged_in}")

    if not logged_in:
        print("Need to log in first...")
        # Navigate to login page
        send_cmd(ws, "Page.navigate", {"url": "https://www.xtratime.org/login/"})
        wait_for_load(ws)
        time.sleep(2)

        # Fill login form
        evaluate(ws, """
            document.querySelector('input[name="login"]').focus();
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": "tikitaka_vip"})
        time.sleep(0.5)

        evaluate(ws, """
            document.querySelector('input[name="password"]').focus();
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": "TK!v1p_2026WC#secure"})
        time.sleep(0.5)

        # Submit
        evaluate(ws, """
            document.querySelector('button.button--primary[type="submit"], input[type="submit"]').click();
        """)
        wait_for_load(ws)
        time.sleep(3)

        # Check login success
        logged_in = evaluate(ws, """
            !!document.querySelector('.p-navgroup--member') ||
            !!document.querySelector('a[href*="account/"]')
        """)
        print(f"Login result: {logged_in}")

        if not logged_in:
            # Check for error
            error = evaluate(ws, "document.querySelector('.blockMessage--error')?.textContent || ''")
            print(f"Login error: {error}")

            # Take screenshot for debugging
            screenshot = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
            if screenshot.get("data"):
                import base64
                with open("/tmp/xtratime_login.png", "wb") as f:
                    f.write(base64.b64decode(screenshot["data"]))
                print("Screenshot saved to /tmp/xtratime_login.png")

            ws.close()
            return False

        # Navigate back to thread
        print("Navigating back to thread...")
        send_cmd(ws, "Page.navigate", {"url": THREAD_URL})
        wait_for_load(ws)
        time.sleep(3)

    # Scroll to bottom to find reply box
    evaluate(ws, "window.scrollTo(0, document.body.scrollHeight)")
    time.sleep(2)

    # Check for reply editor - XenForo uses a rich text editor
    has_reply = evaluate(ws, """
        !!(document.querySelector('.js-editor textarea') ||
           document.querySelector('textarea[name="message"]') ||
           document.querySelector('.fr-element') ||
           document.querySelector('[data-xf-init*="editor"]'))
    """)
    print(f"Reply box found: {has_reply}")

    # Try clicking the reply area to activate it
    evaluate(ws, """
        // Try various XenForo editor selectors
        var editor = document.querySelector('.js-editor .fr-element.fr-view');
        if (editor) { editor.click(); editor.focus(); }
        else {
            var ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.click(); ta.focus(); }
        }
    """)
    time.sleep(1)

    # Take a screenshot to see current state
    screenshot = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
    if screenshot.get("data"):
        import base64
        with open("/tmp/xtratime_thread.png", "wb") as f:
            f.write(base64.b64decode(screenshot["data"]))
        print("Screenshot: /tmp/xtratime_thread.png")

    # Check page title and URL
    title = evaluate(ws, "document.title")
    url = evaluate(ws, "window.location.href")
    print(f"Page: {title}")
    print(f"URL: {url}")

    # Try to find the reply box and type into it
    # XenForo 2.x uses Froala editor
    found_editor = evaluate(ws, """
        (function() {
            // Method 1: Froala editor
            var froala = document.querySelector('.fr-element.fr-view');
            if (froala) return 'froala';

            // Method 2: textarea fallback
            var ta = document.querySelector('textarea[name="message"]');
            if (ta) return 'textarea';

            // Method 3: contenteditable
            var ce = document.querySelector('[contenteditable="true"]');
            if (ce) return 'contenteditable';

            // Method 4: check if we need to click "Write your reply..."
            var placeholder = document.querySelector('.js-editor');
            if (placeholder) return 'js-editor';

            return 'none';
        })()
    """)
    print(f"Editor type: {found_editor}")

    if found_editor == 'froala':
        # Click and focus the Froala editor
        evaluate(ws, """
            var el = document.querySelector('.fr-element.fr-view');
            el.click();
            el.focus();
        """)
        time.sleep(0.5)

        # Use insertText
        send_cmd(ws, "Input.insertText", {"text": REPLY_TEXT})
        time.sleep(1)

    elif found_editor == 'textarea':
        evaluate(ws, """
            var ta = document.querySelector('textarea[name="message"]');
            ta.click();
            ta.focus();
        """)
        time.sleep(0.5)
        send_cmd(ws, "Input.insertText", {"text": REPLY_TEXT})
        time.sleep(1)

    elif found_editor == 'js-editor':
        # Need to click to activate the editor first
        evaluate(ws, """
            var editor = document.querySelector('.js-editor');
            if (editor) {
                var clickTarget = editor.querySelector('.fr-wrapper') || editor;
                clickTarget.click();
            }
        """)
        time.sleep(2)

        # Now try again
        found_after = evaluate(ws, """
            var froala = document.querySelector('.fr-element.fr-view');
            if (froala) { froala.click(); froala.focus(); return 'froala'; }
            var ta = document.querySelector('textarea[name="message"]');
            if (ta) { ta.click(); ta.focus(); return 'textarea'; }
            return 'none';
        """)
        print(f"Editor after click: {found_after}")

        if found_after != 'none':
            send_cmd(ws, "Input.insertText", {"text": REPLY_TEXT})
            time.sleep(1)
        else:
            print("Could not activate editor")
            ws.close()
            return False
    else:
        print("No editor found - might need to scroll or page structure is different")
        # Dump some page info
        info = evaluate(ws, """
            JSON.stringify({
                bodyClasses: document.body.className,
                hasForm: !!document.querySelector('form'),
                forms: Array.from(document.querySelectorAll('form')).map(f => f.action).slice(0, 5),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 10)
            })
        """)
        print(f"Page info: {info}")
        ws.close()
        return False

    # Verify text was entered
    time.sleep(1)
    content = evaluate(ws, """
        (function() {
            var froala = document.querySelector('.fr-element.fr-view');
            if (froala) return froala.textContent.substring(0, 100);
            var ta = document.querySelector('textarea[name="message"]');
            if (ta) return ta.value.substring(0, 100);
            return '';
        })()
    """)
    print(f"Content preview: {content}")

    if not content or len(content) < 10:
        print("Text entry may have failed")
        screenshot = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
        if screenshot.get("data"):
            import base64
            with open("/tmp/xtratime_editor.png", "wb") as f:
                f.write(base64.b64decode(screenshot["data"]))
            print("Screenshot: /tmp/xtratime_editor.png")
        ws.close()
        return False

    # Take screenshot before submitting
    screenshot = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
    if screenshot.get("data"):
        import base64
        with open("/tmp/xtratime_before_submit.png", "wb") as f:
            f.write(base64.b64decode(screenshot["data"]))
        print("Screenshot before submit: /tmp/xtratime_before_submit.png")

    # Click Post Reply button
    evaluate(ws, """
        var btn = document.querySelector('button.button--primary[type="submit"]');
        if (!btn) btn = document.querySelector('.formSubmitRow button[type="submit"]');
        if (!btn) btn = Array.from(document.querySelectorAll('button')).find(b =>
            b.textContent.trim().toLowerCase().includes('post reply'));
        if (btn) btn.click();
    """)

    print("Clicked submit...")
    time.sleep(5)

    # Check result
    new_url = evaluate(ws, "window.location.href")
    print(f"After submit URL: {new_url}")

    # Take final screenshot
    screenshot = send_cmd(ws, "Page.captureScreenshot", {"format": "png"})
    if screenshot.get("data"):
        import base64
        with open("/tmp/xtratime_after_submit.png", "wb") as f:
            f.write(base64.b64decode(screenshot["data"]))
        print("Final screenshot: /tmp/xtratime_after_submit.png")

    # Check for errors
    error = evaluate(ws, """
        (function() {
            var err = document.querySelector('.blockMessage--error');
            if (err) return err.textContent.trim();
            var errs = document.querySelectorAll('.formRow--error');
            if (errs.length) return Array.from(errs).map(e => e.textContent.trim()).join('; ');
            return '';
        })()
    """)
    if error:
        print(f"Error: {error}")
        ws.close()
        return False

    print("Reply posted successfully!")
    ws.close()
    return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
