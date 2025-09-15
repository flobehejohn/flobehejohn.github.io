export let visualStateIdx = 0;
export let currentState = "init";

export function switchToNextState(idx, state) {
    visualStateIdx = idx;
    currentState = state;
}
