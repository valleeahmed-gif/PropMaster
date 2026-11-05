// Landing page behaviour (kept out of inline <script> so the site can run
// under a strict Content-Security-Policy).
const observer = new IntersectionObserver(
  entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
);
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

const year = document.getElementById('footer-year');
if (year) year.textContent = String(new Date().getFullYear());
