import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { effectiveMusicVolume } from '@/lib/audioMix';
import { BarLoop } from '@/lib/barMusic';

// The loop lives for the signed-in session. A gesture resumes the audio
// context (iOS will not start one that was built in an effect), and the
// fader decides whether any note is scheduled.
const BarMusic = () => {
  const musicOn = useGameStore((s) => s.musicOn);
  const musicVolume = useGameStore((s) => s.musicVolume);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const volume = effectiveMusicVolume({ musicOn, musicVolume, audioMuted });
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const loopRef = useRef(null);

  useEffect(() => {
    const loop = new BarLoop();
    loopRef.current = loop;
    const arm = () => {
      loop.ensure();
      loop.setVolume(volumeRef.current);
    };
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      loop.stop();
      loopRef.current = null;
    };
  }, []);

  useEffect(() => {
    loopRef.current?.setVolume(volume);
  }, [volume]);

  return null;
};

export default BarMusic;
