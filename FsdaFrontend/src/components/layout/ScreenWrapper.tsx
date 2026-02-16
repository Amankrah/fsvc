import React from 'react';
import { View, StyleSheet, ViewStyle, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/theme';

interface ScreenWrapperProps {
    children: React.ReactNode;
    style?: ViewStyle;
    backgroundColor?: string;
    edges?: {
        top?: boolean;
        bottom?: boolean;
        left?: boolean;
        right?: boolean;
    };
}

/**
 * ScreenWrapper
 * 
 * A reusable wrapper component that applies safe area insets to its children.
 * useful for ensuring content isn't hidden behind notches, status bars, or home indicators.
 * 
 * @param children - The content to wrap
 * @param style - Additional styles for the container
 * @param backgroundColor - Background color (defaults to theme background)
 * @param edges - Which edges to apply safe area padding to (default: all)
 */
export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
    children,
    style,
    backgroundColor = colors.background.default,
    edges = { top: true, bottom: true, left: true, right: true },
}) => {
    const insets = useSafeAreaInsets();

    const containerStyle: ViewStyle = {
        flex: 1,
        backgroundColor,
        paddingTop: edges.top ? insets.top : 0,
        paddingBottom: edges.bottom ? insets.bottom : 0,
        paddingLeft: edges.left ? insets.left : 0,
        paddingRight: edges.right ? insets.right : 0,
        ...style,
    };

    return (
        <View style={containerStyle}>
            <StatusBar
                barStyle="dark-content"
                backgroundColor="transparent"
                translucent
            />
            {children}
        </View>
    );
};
