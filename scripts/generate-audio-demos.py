import wave, math, struct
from pathlib import Path
out=Path('frontend/assets/audio')
rate=22050
for name,bpm,base in [('low-tide',68,164.81),('slow-static',78,174.61),('half-light',96,196),('wire-and-wave',112,220),('redline',128,246.94)]:
 beat=60/bpm; duration=beat*8; notes=[1,1.25,1.5,1.25,1.125,1.5,1.75,1.5]
 with wave.open(str(out/(name+'.wav')),'wb') as f:
  f.setparams((1,2,rate,0,'NONE','not compressed'));samples=[]
  for i in range(int(duration*rate)):
   t=i/rate;note=min(7,int(t/beat));local=t-note*beat;env=min(1,local/.025)*max(0,1-local/(beat*.92));freq=base*notes[note]
   v=.22*env*(math.sin(2*math.pi*freq*t)+.22*math.sin(2*math.pi*freq*2*t))+.07*math.exp(-local*22)*math.sin(2*math.pi*65*t)
   samples.append(struct.pack('<h',int(max(-1,min(1,v))*32767)))
  f.writeframes(b''.join(samples))
with wave.open(str(out/'silence.wav'),'wb') as f:
 f.setparams((1,2,rate,0,'NONE','not compressed'));f.writeframes(b'\0\0'*2205)
print('Generated five original demo clips and a silent audio activation clip.')
