
import { soundManager } from "@/utils/sound/SoundManager";
import { VoiceType, VoicePlayOptions } from "@/lib/types/voiceTypes";

export class VoicePlayerService {
  private timeoutRef: number | null = null;
  private volume: number = 0.7;
  private pitch: number = 1;
  private rate: number = 1;
  private voiceMap: Record<VoiceType, string> = {
    naughty: 'female',
    nasty: 'male',
    neutral: 'female'
  };
  
  constructor() {
    // Initialize with browser's speech synthesis if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      console.log("Speech synthesis available");
    }
  }
  
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }
  
  public setPitch(pitch: number): void {
    this.pitch = Math.max(0.5, Math.min(2, pitch));
  }
  
  public setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2, rate));
  }

  public stopSpeaking(): void {
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
      this.timeoutRef = null;
    }
    
    // Stop any active speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public play(message: string, voiceType: VoiceType, options?: VoicePlayOptions): void {
    // Stop any current speech
    this.stopSpeaking();
    
    // Log the message (in a real app, this would connect to TTS)
    console.log(`[Voice: ${voiceType}]: ${message}`);
    
    // Play corresponding sound based on voice type
    const soundId = voiceType === 'naughty' ? 'naughtyTaunt' : 
                   voiceType === 'nasty' ? 'nastyTaunt' : 'notification';
    
    soundManager.playSound(soundId);
    
    // Use browser's speech synthesis if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speakWithSynthesis(message, voiceType);
    }
  }
  
  private speakWithSynthesis(message: string, voiceType: VoiceType): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(message);
    
    // Set voice based on type
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const desiredGender = this.voiceMap[voiceType];
      
      // Try to find a voice that matches the desired gender
      const matchingVoice = voices.find(voice => 
        voice.name.toLowerCase().includes(desiredGender)
      );
      
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      } else {
        // Fallback to the first available voice
        utterance.voice = voices[0];
      }
    }
    
    // Set properties
    utterance.volume = this.volume;
    utterance.pitch = voiceType === 'naughty' ? this.pitch * 1.2 : 
                     voiceType === 'nasty' ? this.pitch * 0.8 : 
                     this.pitch;
    utterance.rate = voiceType === 'naughty' ? this.rate * 0.9 : 
                    voiceType === 'nasty' ? this.rate * 1.1 : 
                    this.rate;
    
    // Speak the message
    window.speechSynthesis.speak(utterance);
  }

  // This would be replaced with actual TTS functionality in a production app
  public simulatePlayback(message: string, voiceType: VoiceType, callback: () => void): void {
    // Stop any current speech
    this.stopSpeaking();
    
    // Play corresponding sound based on voice type
    const soundId = voiceType === 'naughty' ? 'naughtyTaunt' : 
                   voiceType === 'nasty' ? 'nastyTaunt' : 'notification';
    
    soundManager.playSound(soundId);
    
    // Use browser's speech synthesis if available
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.speakWithSynthesis(message, voiceType);
    }
    
    // Simulate speaking duration based on message length
    const speakDuration = Math.min(2000 + message.length * 60, 8000);
    
    this.timeoutRef = window.setTimeout(() => {
      this.timeoutRef = null;
      callback();
    }, speakDuration);
  }
}

// Singleton instance
export const voicePlayer = new VoicePlayerService();
