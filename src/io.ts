export function saveBinary(data:Uint32Array, filename:string) {
  let blob = new Blob([data], {type: 'octet/stream'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export const openFile = async () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.addEventListener('change', () => {
      input.files instanceof FileList
        ? resolve(input.files[0])
        : console.error('No file!');
    });
    input.click();
  });
};

export const readFile = async (call:(data:Uint32Array)=>void) => {
  const file = await openFile() as File;
  const reader = new FileReader();
  reader.onload = evt => {
    const data = new Uint32Array(evt.target?.result as ArrayBuffer);
    call(data);
  }
  reader.readAsArrayBuffer(file);
}