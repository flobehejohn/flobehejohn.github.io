// assets/js/contact-mailto.js
// Remplace l’envoi serveur par un mailto sécurisé côté client.
// - Valide les champs requis
// - Construit un mailto vers l’adresse issue de #emailSafe (data-user/domain)
// - N’envoie aucune donnée à un serveur

(function () {
  'use strict';

  function $(sel, root) { return (root || document).querySelector(sel); }

  function buildEmailFromSafe() {
    const holder = $('#emailSafe');
    if (!holder) return null;
    const user = holder.getAttribute('data-user') || '';
    const domain = holder.getAttribute('data-domain') || '';
    const email = (user && domain) ? (user + '@' + domain) : null;
    if (!email) return null;
    // Remplacer le texte protégé par un lien mailto (améliore UX)
    try {
      holder.innerHTML = '';
      const a = document.createElement('a');
      a.href = 'mailto:' + email;
      a.textContent = email;
      a.rel = 'noopener noreferrer';
      holder.appendChild(a);
    } catch {}
    return email;
  }

  function encode(s) { return encodeURIComponent(s).replace(/%20/g, '+'); }

  function onReady() {
    const form = $('#contactForm');
    if (!form) return;

    const nameEl = $('#name', form);
    const emailEl = $('#email', form);
    const msgEl = $('#message', form);
    const submitBtn = $('#submitBtn', form);
    const spinner = $('#submitSpinner', form);
    const messages = $('#messages', form.closest('article') || document);

    const targetEmail = buildEmailFromSafe();

    function setLoading(on) {
      if (!submitBtn || !spinner) return;
      submitBtn.disabled = !!on;
      spinner.classList.toggle('d-none', !on);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (!form.checkValidity()) {
        form.classList.add('was-validated');
        return;
      }

      const to = targetEmail || 'florian.behejohn@hotmail.fr';
      const subject = '[Contact] Depuis le site';
      const body = [
        'Nom: ' + (nameEl?.value || ''),
        'Email: ' + (emailEl?.value || ''),
        '',
        (msgEl?.value || '')
      ].join('\n');

      const href = 'mailto:' + encodeURIComponent(to) +
                   '?subject=' + encode(subject) +
                   '&body=' + encode(body);

      setLoading(true);
      try {
        window.location.href = href;
        if (messages) {
          messages.innerHTML = '<div class="alert alert-info" role="status">Ouverture de votre client e‑mail…</div>';
        }
      } finally {
        setLoading(false);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();

