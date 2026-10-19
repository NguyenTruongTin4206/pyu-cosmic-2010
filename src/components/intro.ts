import gsap from 'gsap';
import { $, dur } from '../utils';

export interface Intro { show: () => void; hide: () => void }

export function createIntro(onStart: () => void): Intro {
  const el = $('intro'), btn = $<HTMLButtonElement>('introStart');
  const parts = Array.from(el.children) as HTMLElement[];
  function show(): void {
    el.hidden = false; btn.disabled = false; gsap.set(el, { autoAlpha: 1 });
    gsap.fromTo(parts, { autoAlpha: 0, y: 18, filter: 'blur(8px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: dur(1.1), stagger: dur(0.45), delay: dur(0.3), ease: 'power2.out', overwrite: true });
  }
  function hide(): void { gsap.to(el, { autoAlpha: 0, duration: dur(0.9), ease: 'power2.inOut', onComplete: () => { el.hidden = true; } }); }
  btn.addEventListener('click', () => { btn.disabled = true; onStart(); });
  show();
  return { show, hide };
}
