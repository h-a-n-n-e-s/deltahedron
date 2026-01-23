// routines from 'Real-Time Collision Detection' by Christer Ericson
// return -1 means no intersection

fn raySphereIntersection(global:GlobalParameter, obj:Object) -> f32 {

  let m = global.eye - obj.position;
  let b = dot(m, global.mouseRay);
  let c = dot(m, m) - obj.radius * obj.radius; // radius is radius

  if b > 0 && c > 0 {return -1;}

  let dis = b * b - c;

  if dis < 0 {return -1;}

  return - b - sqrt(dis);
}

fn rayCylinderIntersection(global:GlobalParameter, obj:Object) -> f32 {

  let y = vec3f(0,1,0);
  let q = obj.quarternion;
  let cylinderAxis = y + 2 * cross(q.xyz, cross(q.xyz, y) + q.w * y);

  let r = obj.radius; // radius
  let d = cylinderAxis * obj.length;
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

fn rayTriangleIntersection(global:GlobalParameter, a:vec3f, b:vec3f, c:vec3f) -> f32 {

  let m = cross(global.mouseRay, global.eye);
  let s = dot(m, c - b);
  let t = dot(m, a - c);

  let u = dot(global.mouseRay, cross(c, b)) + s;
  if u < 0 {return -1;}
  let v = dot(global.mouseRay, cross(a, c)) + t;
  if v < 0 {return -1;}
  let w = dot(global.mouseRay, cross(b, a)) - s - t;
  if w < 0 {return -1;}

  let d = 1.0 / (u + v + w);

  let intersectionPoint = a * u * d + b * v * d + c * w * d;

  return length(intersectionPoint - global.eye);
}
