// routines from "Real-Time Collision Detection" by Christer Ericson
// return -1 means no intersection

fn raySphereIntersection(global:GlobalParameter, obj:Object) -> f32{

  let m = global.eye - obj.position;
  let b = dot(m, global.mouseRay);
  let c = dot(m, m) - obj.prop1 * obj.prop1; // prop1 is radius

  if b > 0 && c > 0 {return -1;}

  let dis = b * b - c;

  if dis < 0 {return -1;}

  return - b - sqrt(dis);
}

fn rayCylinderIntersection(global:GlobalParameter, obj:Object) -> f32 {

  let y = vec3f(0,1,0);
  let q = obj.quarternion;
  let cylinderAxis = y + 2 * cross(q.xyz, cross(q.xyz, y) + q.w * y);

  let r = obj.prop1; // radius
  let d = cylinderAxis * obj.prop2; // prop2 is length
  let m = global.eye - obj.position + 0.5 * d;
  let n = global.mouseRay * 1000;

  let md = dot(m, d);
  let nd = dot(n, d);
  let dd = dot(d, d);

  if md < 0 && md + nd < 0 {return -1;}
  if md > dd && md + nd > dd {return -1;}
  
  let nn = dot(n,n);
  let mn = dot(m,n);
  let a = dd * nn - nd * nd;
  let k = dot(m,m) - r * r;
  let c = dd * k - md * md;

  var t:f32;

  if abs(a) < 0.0001 {
    if c > 0 {return -1;}
    
    if md < 0 {t = - mn / nn;}
    else if md > dd {t = (nd - mn) / nn;}
    else {t = 0;}
    return t;
  }

  let b = dd * mn - nd * md;
  let dis = b * b - a * c;
  
  if dis < 0 {return -1;}

  t = - (b + sqrt(dis)) / a;
  let t0 = t;

  if md + t * nd < 0 {
    if nd <= 0 {return -1;}
    t = - md /nd;
    if k + t * (2 * mn + t * nn) <= 0 {return t;}
    else {return -1;}
  }
  else if md + t * nd > dd {
    if nd >= 0 {return -1;}
    t = (dd - md) / nd;
    if k + dd - 2 * md + t * (2 * (mn - nd) + t * nn) <= 0 {return t;}
    else {return -1;}
  }

  return t0;
}