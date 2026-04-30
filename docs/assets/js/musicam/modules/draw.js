export function drawSkeleton(ctx, kps, SKELETON){
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,200,255,0.9)';
    for (const [a, b] of SKELETON) {
      const A = kps[a], B = kps[b];
      if (A?.score > 0.4 && B?.score > 0.4) {
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      }
    }
  }
  
  export function drawKeypoints(ctx, kps){
    for (const kp of kps) {
      if (kp.score > 0.4) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#9BE7FF'; ctx.fill();
        ctx.strokeStyle = '#0a2230'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  }
  
  export function drawFace(ctx, points){
    if (!points) return;
    ctx.fillStyle = 'rgba(255,179,71,0.9)';
    for (const p of points) {
      const x = p.x ?? (Array.isArray(p) ? p[0] : null);
      const y = p.y ?? (Array.isArray(p) ? p[1] : null);
      if (x != null && y != null) {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
      }
    }
  }
  