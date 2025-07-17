'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Autocomplete } from '@/components/ui/autocomplete';
import { cn } from '@/lib/utils';
import {
  Square,
  RectangleHorizontal,
  RectangleVertical,
  UploadCloud,
  RefreshCcw,
} from 'lucide-react';
import Image from 'next/image';

// Map of mediums to their available styles
const mediumStyles: Record<string, { styles: string[] }> = {
  'Digital painting': {
    styles: [
      'Cartoon',
      'Anime',
      'Realistic',
      'Watercolor',
      'Cyberpunk',
      'Concept Art',
      'Fantasy',
      'Matte Painting',
      'Cel-shaded',
      'Synthwave',
    ],
  },
  'Oil painting': {
    styles: [
      'Pointillism',
      'Impressionism',
      'Post-Impressionism',
      'Realistic',
      'Abstract',
      'Surrealism',
      'Expressionism',
      'Romantic',
      'Baroque',
      'Cubism',
      'Fauvism',
      'Neo-Classicism',
      'Modernism',
      'Ancient Hindu',
    ],
  },
  '3D render': {
    styles: [
      'Realistic',
      'Photorealistic',
      'Abstract',
      'Surrealism',
      'Low-poly',
      'Voxel',
      'Stylized',
      'Cartoonish',
    ],
  },
  'Pencil sketch': {
    styles: [
      'Realistic',
      'Abstract',
      'Surrealism',
      'Gesture',
      'Cross-hatching',
      'Caricature',
      'Comic',
      'Blueprint',
    ],
  },
  Photograph: {
    styles: [
      'Realistic',
      'Abstract',
      'Surrealism',
      'Black and White',
      'Film Grain',
      'HDR',
      'Macro',
      'Panorama',
      'Candid',
    ],
  },
  // ---- Added mediums ----
  'Watercolor painting': {
    styles: ['Loose', 'Wet-on-wet', 'Drybrush', 'Realistic', 'Abstract'],
  },
  'Acrylic painting': {
    styles: ['Impasto', 'Realistic', 'Abstract', 'Pour', 'Palette knife'],
  },
  'Ink wash / Sumi-e': {
    styles: ['Traditional', 'Minimalist', 'Monochrome', 'Expressive'],
  },
  'Charcoal drawing': {
    styles: ['Sketch', 'Realistic', 'Abstract', 'Gestural'],
  },
  'Pastel drawing': {
    styles: ['Soft', 'Oil', 'Impressionistic', 'Realistic', 'Abstract'],
  },
  'Vector illustration': {
    styles: ['Flat', 'Minimalist', 'Isometric', 'Bold', 'Line art'],
  },
  'Pixel art': {
    styles: ['8-bit', '16-bit', 'Monochrome', 'Isometric', 'Animated'],
  },
  'Clay sculpture': {
    styles: ['Realistic', 'Stylized', 'Cartoon', 'Abstract'],
  },
  'Graffiti street art': {
    styles: ['Wildstyle', 'Stencil', 'Bubble', 'Throw-up', 'Character'],
  },
  'Mosaic tile': {
    styles: ['Classic', 'Modern', 'Abstract', 'Geometric', 'Photorealistic'],
  },
} as const;

const filterOptions = [
  'Fisheye',
  'Blur',
  'Grayscale',
  'Sepia',
  'Vignette',
  'Vintage',
  'HDR',
  'Macro',
  'Panorama',
  'Candid',
];
const moodOptions = [
  'Dark',
  'Mysterious',
  'Pleasant',
  'Playful',
  'Whimsical',
  'Gothic',
  'Ethereal',
  'Gloomy',
  'Dreamy',
];
const themeOptions = [
  'Fantasy',
  'Sci-fi',
  'Cyberpunk',
  'Realistic',
  'Gothic',
  'Gloomy',
  'Dreamy',
  'Patriotic',
  'Halloween',
  'Christmas',
  'Valentines',
  'Easter',
  'Thanksgiving',
];

// Flatten list of all styles for default option list
const ALL_STYLES: string[] = Array.from(
  new Set(
    Object.values(mediumStyles)
      .flatMap(m => m.styles)
      .map(s => s.trim())
  )
);

export default function AvatarMakerPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [size, setSize] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024');
  const mediums = ['', ...Object.keys(mediumStyles)];
  const [style, setStyle] = useState<string>('');
  const [medium, setMedium] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [mood, setMood] = useState<string>('');
  const [theme, setTheme] = useState<string>('');

  // Style list becomes dependent on selected medium
  const styleOptions = medium && mediumStyles[medium] ? mediumStyles[medium].styles : ALL_STYLES;

  // Reset style if it's not valid for the chosen medium
  useEffect(() => {
    if (medium && mediumStyles[medium] && style && !mediumStyles[medium].styles.includes(style)) {
      setStyle('');
    }
  }, [medium, style]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // reset generated images when new image selected
      setGeneratedImages([]);
    }
  };

  const convertToPng = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Failed to convert image'));
            return;
          }
          const pngFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), {
            type: 'image/png',
          });
          resolve(pngFile);
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const createTransparentMask = (width: number, height: number): File => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // no drawing means fully transparent
    return new File([canvas.toDataURL('image/png')], 'mask.png', {
      type: 'image/png',
    });
  };

  const handleGenerate = async () => {
    if (!imageFile) return;
    try {
      setLoading(true);

      // Ensure PNG format as required by OpenAI edit endpoint
      let uploadFile: File = imageFile;
      if (uploadFile.type !== 'image/png') {
        uploadFile = await convertToPng(uploadFile);
      }

      // Create a fully transparent mask of same dimensions
      const img = new window.Image();
      img.src = URL.createObjectURL(uploadFile);
      await new Promise(resolve => (img.onload = resolve));
      const maskFile = createTransparentMask(img.width, img.height);

      const formData = new FormData();
      formData.append('image', uploadFile);
      formData.append('mask', maskFile);

      // Build enhanced prompt
      const extra: string[] = [];
      if (style !== 'None') extra.push(`${style} style`);
      if (medium !== 'None') extra.push(`in ${medium}`);
      if (filter !== 'None') extra.push(`with ${filter} filter`);
      if (mood !== 'None') extra.push(`in ${mood} mood`);
      if (theme !== 'None') extra.push(`in ${theme} theme`);

      const finalPrompt = `${prompt && prompt + ', '} ${extra.length ? extra.join(', ') : ''}`;

      formData.append('prompt', finalPrompt);
      formData.append('n', '4');
      formData.append('size', size);

      const res = await fetch('/api/v1/avatar-maker/edit', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate image');
      }

      const data: { images: string[] } = await res.json();
      setGeneratedImages(prev => [...prev, ...data.images]);
    } catch (err) {
      console.error(err);
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-cream-white">Avatar Maker</h1>
          <p className="text-slate-400 mt-2">
            Upload an image and let the AI turn it into unique avatars
          </p>
        </div>

        <div className="relative flex flex-col gap-1 bg-space-dark border border-space-purple/30 rounded-2xl p-8 md:p-12 space-y-8 overflow-hidden">
          {/* loading overlay */}
          {loading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col gap-4 items-center justify-center z-10 animate-fade-in">
              <span className="h-10 w-10 border-4 border-t-transparent border-space-purple rounded-full animate-spin" />
              <p className="text-cream-white">Generating avatar...</p>
            </div>
          )}

          {/* Upload */}
          <div className="space-y-4">
            <Label className="text-slate-400">1. Upload a base image</Label>
            {/* Hidden real input */}
            <input
              ref={fileInputRef}
              id="image"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const files = e.dataTransfer.files;
                if (files?.length) {
                  const fileList: FileList = files;
                  handleFileChange({
                    target: { files: fileList },
                  } as unknown as React.ChangeEvent<HTMLInputElement>);
                }
              }}
              className={cn(
                'flex flex-col items-center justify-center gap-2 px-6 py-10 rounded-lg border-2 border-dashed transition-colors cursor-pointer',
                imageFile ? 'border-space-purple' : 'border-slate-700 hover:border-space-purple'
              )}
            >
              {imageFile ? (
                <Image
                  src={URL.createObjectURL(imageFile)}
                  alt="Uploaded preview"
                  className="rounded max-h-80 object-contain w-full"
                  width={320}
                  height={320}
                />
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-slate-400" />
                  <p className="text-slate-400 text-sm">Click or drag & drop to upload</p>
                </>
              )}
            </div>
          </div>
          <hr className="border-space-purple" />

          {/* Prompt */}
          <div className="space-y-2">
            <Label htmlFor="prompt" className="text-slate-400">
              2. Enter a prompt to edit the image
            </Label>
            <Textarea
              id="prompt"
              placeholder="e.g. Turn this photo into a cyber-punk cartoon avatar wearing sunglasses"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="bg-slate-800 border-slate-700 text-cream-white mt-1"
            />
          </div>

          <hr className="border-space-purple" />

          {/* Optional parameters */}
          <Label className="text-slate-400">3. Optional parameters</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-slate-400">Medium</Label>
              <Autocomplete
                value={medium}
                onChange={setMedium}
                options={mediums}
                placeholder="Oil painting, 3D render..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">Style</Label>
              <Autocomplete
                value={style}
                onChange={setStyle}
                options={['', ...styleOptions]}
                placeholder="Cartoon, Realistic..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">Filter</Label>
              <Autocomplete
                value={filter}
                onChange={setFilter}
                options={['', ...filterOptions]}
                placeholder="Cartoon, Realistic..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">Mood</Label>
              <Autocomplete
                value={mood}
                onChange={setMood}
                options={['', ...moodOptions]}
                placeholder="Cartoon, Realistic..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400">Theme</Label>
              <Autocomplete
                value={theme}
                onChange={setTheme}
                options={['', ...themeOptions]}
                placeholder="Cartoon, Realistic..."
              />
            </div>
          </div>

          <hr className="border-space-purple" />

          {/* Orientation */}
          <div className="space-y-2">
            <Label className="text-slate-400">Orientation</Label>
            <div className="flex gap-2">
              {(
                [
                  { val: '1024x1536', icon: <RectangleVertical className="w-4 h-4" /> },
                  { val: '1024x1024', icon: <Square className="w-4 h-4" /> },
                  { val: '1536x1024', icon: <RectangleHorizontal className="w-4 h-4" /> },
                ] as { val: typeof size; icon: React.ReactNode }[]
              ).map(o => (
                <button
                  key={o.val}
                  type="button"
                  onClick={() => setSize(o.val)}
                  className={cn(
                    'flex items-center justify-center gap-1 px-3 py-2 rounded-md text-sm border transition-colors',
                    size === o.val
                      ? 'bg-space-purple text-cream-white border-space-purple'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  )}
                >
                  {o.icon}
                </button>
              ))}
            </div>
          </div>

          {generatedImages.length === 0 && (
            <Button
              onClick={handleGenerate}
              disabled={!imageFile || loading}
              className={cn('w-full bg-space-purple hover:bg-space-purple/80 text-cream-white', {
                'opacity-75': loading,
              })}
            >
              {loading ? 'Generating...' : 'Generate Avatar'}
            </Button>
          )}

          {generatedImages.length > 0 && (
            <div className="space-y-6 animate-in fade-in">
              <div>
                <h2 className="text-2xl font-semibold text-center text-cream-white mb-4 text-center">
                  Generated Avatar{generatedImages.length > 1 ? 's' : ''}
                </h2>
                <div className="gap-4 justify-center items-center w-full">
                  {generatedImages.map(src => (
                    <div key={src}>
                      <Image
                        src={src}
                        alt="Generated avatar"
                        className="rounded border border-slate-700 object-contain w-full"
                        width={320}
                        height={320}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="bg-space-blue hover:bg-space-blue/80 text-cream-white w-full"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  {loading ? 'Generating...' : 'Generate More'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
