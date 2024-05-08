

fn raySphereIntersection(global:GlobalParameter, obj:Object) -> bool {

  let m = global.eye - obj.position;
  let c = dot(m, m) - obj.size * obj.size;

  if c < 0 {return true;}

  let b = dot(m, global.mouseRay);

  if b > 0 {return false;}

  let dis = b * b - c;

  if dis < 0 {return false;}

  return true;
}
