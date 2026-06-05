export const trapMap = new Map();
let playerColliderHandle = null;

export function registerPlayer(colliderHandle) {
    playerColliderHandle = colliderHandle;
}

export function getPlayerHandle() {
    return playerColliderHandle;
}

export function registerTrap(colliderHandle, trapInstance) {
    if (colliderHandle !== undefined && colliderHandle !== null) {
        trapMap.set(colliderHandle, trapInstance);
    }
}

export function unregisterTrap(colliderHandle) {
    if (colliderHandle !== undefined && colliderHandle !== null) {
        trapMap.delete(colliderHandle);
    }
}

export function handleTrapCollisions(physicsWorld, eventQueue) {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        const trap1 = trapMap.get(handle1);
        const trap2 = trapMap.get(handle2);

        if (trap1 || trap2) {
            const trapInstance = trap1 || trap2;
            const otherHandle = trap1 ? handle2 : handle1;

            if (otherHandle === playerColliderHandle) {
                if (started) {
                    trapInstance._catch();
                } else if (trapInstance && typeof trapInstance._release === 'function') {
                    trapInstance._release();
                }
            }
        }
    });
}