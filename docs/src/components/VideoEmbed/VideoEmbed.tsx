import React from 'react';

/**
 * A reusable, styled video embed component for documentation screen recordings.
 * Plays a video file imported into the page (e.g. an MP4 next to the MDX file) with the native player,
 * or embeds any other URL in a responsive iframe. Both are capped at 900px wide and sit inside a <figure>
 * with an optional <figcaption> below.
 *
 * @param {object} props - The component props.
 * @param {string} props.src - The imported video file or the embed URL of the video (required).
 * @param {string} props.title - Accessible title for the video (required).
 * @param {string} [props.caption] - Optional caption displayed below the video.
 * @returns {React.ReactElement} The rendered video embed.
 */
const VideoEmbed = ({
                        src,
                        title,
                        caption,
                    }: {
    src: string;
    title: string;
    caption?: string;
}): React.ReactElement => {
    const frameStyle = { width: '100%', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: '8px', display: 'block' };
    const isVideoFile = /\.(mp4|webm)(\?|#|$)/.test(src);
    return (
        <figure style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', margin: '1.5rem auto', width: '100%', maxWidth: '900px' }}>
            {isVideoFile ? (
                <video src={src} title={title} aria-label={title} controls muted playsInline preload="metadata" style={frameStyle} />
            ) : (
                <div style={{ width: '100%', aspectRatio: '900 / 520' }}>
                    <iframe src={src} title={title} frameBorder="0" allowFullScreen style={{ ...frameStyle, height: '100%' }} />
                </div>
            )}
            {caption && <figcaption style={{ fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center' }}>{caption}</figcaption>}
        </figure>
    );
};

export default VideoEmbed;
