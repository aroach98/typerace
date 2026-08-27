import { useState } from 'react';

export function roomLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

export function Invite({ code, hostName }: { code: string; hostName: string }) {
  const [toast, setToast] = useState<string | null>(null);
  const link = roomLink(code);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  };
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      flash('Copy failed — select it manually');
    }
  };

  const subject = `${hostName} challenged you to a 30-second typing race`;
  const body = `Join my typing race!\n\nOpen this link: ${link}\n\n…or go to ${window.location.origin} and enter the join code ${code}.\n\nIt's 30 seconds — see how many words per minute you can type.`;
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const canShare = typeof navigator.share === 'function';

  return (
    <div>
      <div className="codebox">
        <span className="label">Join code</span>
        <span className="code">{code}</span>
        <span className="link">{link}</span>
      </div>
      <div className="row mt" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={() => void copy(link, 'Link copied!')}>
          🔗 Copy link
        </button>
        <button className="btn secondary" onClick={() => void copy(code, 'Code copied!')}>
          # Copy code
        </button>
        <a className="btn secondary" href={mailto}>
          ✉️ Email invite
        </a>
        {canShare && (
          <button
            className="btn secondary"
            onClick={() => void navigator.share({ title: subject, text: body, url: link }).catch(() => undefined)}
          >
            📤 Share
          </button>
        )}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
