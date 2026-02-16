/**
 * SwipeableQuestionView Component
 * Wraps question content with horizontal swipe gesture detection
 * to navigate between previous and next questions.
 *
 * - Swipe left  → next question
 * - Swipe right → previous question
 * - Includes animated horizontal translation for visual feedback
 * - Respects ScrollView (only triggers on predominantly horizontal swipes)
 */

import React, { useCallback } from 'react';
import { StyleSheet, Animated, useWindowDimensions } from 'react-native';
import {
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    State,
} from 'react-native-gesture-handler';

const SWIPE_THRESHOLD = 60;       // Minimum horizontal distance to trigger navigation
const SWIPE_VELOCITY = 300;       // Alternative: trigger on fast swipe even if short distance
const DIRECTION_LOCK_RATIO = 1.5; // |dx| must be this much larger than |dy| to count as horizontal

interface SwipeableQuestionViewProps {
    children: React.ReactNode;
    onSwipeLeft: () => void;   // Next question
    onSwipeRight: () => void;  // Previous question
    canSwipeLeft: boolean;     // False on last question
    canSwipeRight: boolean;    // False on first question
    enabled?: boolean;         // Disable during submission etc.
}

export const SwipeableQuestionView: React.FC<SwipeableQuestionViewProps> = ({
    children,
    onSwipeLeft,
    onSwipeRight,
    canSwipeLeft,
    canSwipeRight,
    enabled = true,
}) => {
    const { width } = useWindowDimensions();
    const translateX = React.useRef(new Animated.Value(0)).current;

    const onGestureEvent = useCallback(
        (event: PanGestureHandlerGestureEvent) => {
            const { translationX, translationY } = event.nativeEvent;

            // Only allow horizontal drag if it's clearly a horizontal gesture
            if (Math.abs(translationX) > Math.abs(translationY) * DIRECTION_LOCK_RATIO) {
                // Clamp translation to give a subtle drag feel (max ~25% of screen width)
                const maxDrag = width * 0.25;
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
                        if (translationX < 0 && canSwipeLeft) {
                            // Swiped left → next question
                            onSwipeLeft();
                        } else if (translationX > 0 && canSwipeRight) {
                            // Swiped right → previous question
                            onSwipeRight();
                        }
                    }
                }

                // Spring back to center
                Animated.spring(translateX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 120,
                    friction: 8,
                }).start();
            }
        },
        [translateX, onSwipeLeft, onSwipeRight, canSwipeLeft, canSwipeRight]
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
