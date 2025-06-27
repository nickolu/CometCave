'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AvatarMakerPage() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const img = new Image();
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
    if (!imageFile || !prompt) return;
    try {
      setLoading(true);

      // Ensure PNG format as required by OpenAI edit endpoint
      let uploadFile: File = imageFile;
      if (uploadFile.type !== 'image/png') {
        uploadFile = await convertToPng(uploadFile);
      }

      // Create a fully transparent mask of same dimensions
      const img = new Image();
      img.src = URL.createObjectURL(uploadFile);
      await new Promise(resolve => (img.onload = resolve));
      const maskFile = createTransparentMask(img.width, img.height);

      const formData = new FormData();
      formData.append('image', uploadFile);
      formData.append('mask', maskFile);
      formData.append('prompt', prompt);
      formData.append('n', '4');
      formData.append('size', 'auto');

      const res = await fetch('/api/avatar-maker/edit', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to generate image');
      }

      const data: { images: string[] } = await res.json();
      setGeneratedImages(data.images);
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

        <div className="bg-space-dark border border-space-purple/30 rounded-2xl p-8 md:p-12 space-y-8">
          {/* Upload */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="image" className="text-slate-400">
                1. Upload a base image
              </Label>
              <Input
                id="image"
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="bg-slate-800 border-slate-700 text-cream-white mt-1"
              />
            </div>

            {imageFile && (
              <img
                src={URL.createObjectURL(imageFile)}
                alt="Uploaded preview"
                className="rounded max-h-80 object-contain border border-slate-700"
              />
            )}
          </div>

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

          <Button
            onClick={handleGenerate}
            disabled={!imageFile || !prompt || loading}
            className={cn('w-full bg-space-purple hover:bg-space-purple/80 text-cream-white', {
              'opacity-75': loading,
            })}
          >
            {loading ? 'Generating...' : 'Generate Avatar'}
          </Button>

          {generatedImages.length > 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold text-center text-cream-white mb-4">
                  Generated Avatars
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {generatedImages.map(src => (
                    <img
                      key={src}
                      src={src}
                      alt="Generated avatar"
                      className="rounded border border-slate-700 object-contain w-full"
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="bg-space-blue hover:bg-space-blue/80 text-cream-white"
                >
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
