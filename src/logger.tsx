const isDebugEnabled = true;

export function debug(...args: any) {
    if (!isDebugEnabled) {
        return;
    }
    console.log(...args);
}
