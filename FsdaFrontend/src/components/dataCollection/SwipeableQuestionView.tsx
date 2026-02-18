/**
 * SwipeableQuestionView Component
 * Wraps question content with horizontal swipe gesture detection.
 *
 * Features:
 * - Slide Out: Card slides off-screen when swiped.
 * - Slide In: New card slides in from the correct side.
 * - Shake: Visual feedback when swipe is blocked (e.g. invalid response).
 * - Fluid Gestures: Low threshold and natural drag.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Animated, useWindowDimensions, Easing } from 'react-native';
import {
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    State,
} from 'react-native-gesture-handler';

const SWIPE_THRESHOLD = 30;       // Minimum horizontal distance to trigger navigation
const SWIPE_VELOCITY = 300;       // Alternative: trigger on fast swipe even if short distance
const DIRECTION_LOCK_RATIO = 1.2; // |dx| must be this much larger than |dy| to count as horizontal

interface SwipeableQuestionViewProps {
    children: React.ReactNode;
    onSwipeLeft: () => void;   // Next question
    onSwipeRight: () => void;  // Previous question
    canSwipeLeft: boolean;     // False on last question
    canSwipeRight: boolean;    // False on first question
    enabled?: boolean;         // Disable during submission etc.
    // New Props
    onCheckSwipeLeft?: () => boolean;  // Validation check before swiping left
    onCheckSwipeRight?: () => boolean; // Validation check before swiping right
    enterDirection?: 'left' | 'right' | null; // Direction to slide in from
}

export const SwipeableQuestionView: React.FC<SwipeableQuestionViewProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    canSwipeLeft,
    canSwipeRight,
    enabled = true,
    onCheckSwipeLeft,
    onCheckSwipeRight,
    enterDirection = null,
}) => {
    const { width } = useWindowDimensions();

    // Determine initial position for "Slide In" animation
    const initialTranslateX = enterDirection === 'right' ? width : enterDirection === 'left' ? -width : 0;
    const translateX = useRef(new Animated.Value(initialTranslateX)).current;

    // Run Slide In animation on mount if direction is set
    useEffect(() => {
        if (enterDirection) {
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 40,
                friction: 8,
            }).start();
        }
    }, [enterDirection, translateX]);

    const shakeAnimation = () => {
        const duration = 50;
        const offset = 10;

        Animated.sequence([
            Animated.timing(translateX, { toValue: -offset, duration, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(translateX, { toValue: offset, duration, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(translateX, { toValue: -offset / 2, duration, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(translateX, { toValue: offset / 2, duration, useNativeDriver: true, easing: Easing.linear }),
            Animated.timing(translateX, { toValue: 0, duration, useNativeDriver: true, easing: Easing.linear }),
        ]).start();
    };

    const animateOut = (direction: 'left' | 'right', callback: () => void) => {
        const targetValue = direction === 'left' ? -width : width;
        Animated.timing(translateX, {
            toValue: targetValue,
            duration: 250,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad),
        }).start(() => {
            callback();
        });
    };

    const onGestureEvent = useCallback(
        (event: PanGestureHandlerGestureEvent) => {
            const { translationX, translationY } = event.nativeEvent;

            // Only allow horizontal drag if it's clearly a horizontal gesture
            if (Math.abs(translationX) > Math.abs(translationY) * DIRECTION_LOCK_RATIO) {
                // Drag feeling
                const maxDrag = width * 0.4;
                const clamped = Math.max(-maxDrag, Math.min(maxDrag, translationX));
                translateX.setValue(clamped);
            }
        },
        [translateX, width]
    );

    const onHandlerStateChange = useCallback(
        (event: PanGestureHandlerGestureEvent) => {
            if (event.nativeEvent.state === State.END) {
                const { translationX, translationY, velocityX } = event.nativeEvent;

                // Check if this was a predominantly horizontal gesture
                const isHorizontal =
                    Math.abs(translationX) > Math.abs(translationY) * DIRECTION_LOCK_RATIO;

                if (isHorizontal) {
                    const triggeredByDistance = Math.abs(translationX) > SWIPE_THRESHOLD;
                    const triggeredByVelocity = Math.abs(velocityX) > SWIPE_VELOCITY;

                    if (triggeredByDistance || triggeredByVelocity) {
                        // Swiped Left (Next)
                        if (translationX < 0 && canSwipeLeft) {
                            if (onCheckSwipeLeft && !onCheckSwipeLeft()) {
                                shakeAnimation(); // Validation failed
                                return;
                            }
                            // Animate out to left, then call callback
                            animateOut('left', onSwipeLeft);
                            return;
                        }
                        // Swiped Right (Previous)
                        else if (translationX > 0 && canSwipeRight) {
                            if (onCheckSwipeRight && !onCheckSwipeRight()) {
                                shakeAnimation(); // Validation failed
                                return;
                            }
                            // Animate out to right, then call callback
                            animateOut('right', onSwipeRight);
                            return;
                        }
                    }
                }

                // Spring back only if we didn't trigger an animateOut
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 120,
                    friction: 8,
                }).start();
            }
        },
        [translateX, onSwipeLeft, onSwipeRight, canSwipeLeft, canSwipeRight, onCheckSwipeLeft, onCheckSwipeRight, width]
    );

    return (
        <PanGestureHandler
            onGestureEvent={onGestureEvent}
            onHandlerStateChange={onHandlerStateChange}
            activeOffsetX={[-20, 20]}
            failOffsetY={[-15, 15]}
            enabled={enabled}
        >
            <Animated.View
                style={[
                    styles.container,
                    { transform: [{ translateX }] },
                ]}
            >
                {children}
            </Animated.View>
        </PanGestureHandler>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
