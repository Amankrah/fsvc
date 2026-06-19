import React from 'react';
import { View, ViewStyle, StatusBar } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../constants/theme';

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
    /** Renders a standardised in-screen header. Use for screens that don't use the nav header. */
    withHeader?: {
        title: string;
        subtitle?: string;
        right?: React.ReactNode;
    };
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
    children,
    style,
    backgroundColor = colors.background.default,
    edges = { top: true, bottom: true, left: true, right: true },
    withHeader,
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
            {withHeader && (
                <View style={headerStyles.header}>
                    <View style={headerStyles.textBlock}>
                        <Text style={headerStyles.title}>{withHeader.title}</Text>
                        {withHeader.subtitle && (
                            <Text style={headerStyles.subtitle}>{withHeader.subtitle}</Text>
                        )}
                    </View>
                    {withHeader.right && (
                        <View style={headerStyles.right}>{withHeader.right}</View>
                    )}
                </View>
            )}
            {children}
        </View>
    );
};

const headerStyles = {
    header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.light,
        backgroundColor: colors.background.default,
    },
    textBlock: {
        flex: 1,
    },
    title: {
        fontFamily: 'Fraunces-Bold',
        fontSize: typography.fontSize.xl,
        color: colors.text.primary,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontFamily: 'DMSans-Regular',
        fontSize: typography.fontSize.sm,
        color: colors.text.secondary,
        marginTop: 2,
    },
    right: {
        marginLeft: spacing.md,
    },
};
