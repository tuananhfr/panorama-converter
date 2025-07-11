#!/usr/bin/env python3
"""
Test script for Panorama Backend - Upload entire folder
Usage: python test_folder.py <folder_path> [mode]
"""

import requests
import os
import sys
import time
import json
from pathlib import Path

# Configuration
API_BASE = "http://localhost:5000/api"
SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff'}

def get_images_from_folder(folder_path):
    """Get all image files from folder"""
    folder = Path(folder_path)
    if not folder.exists():
        raise FileNotFoundError(f"Folder not found: {folder_path}")
    
    image_files = []
    for file_path in folder.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_FORMATS:
            image_files.append(file_path)
    
    # Sort by name for better results
    image_files.sort()
    return image_files

def upload_folder(folder_path, mode='auto'):
    """Upload all images in folder to panorama API"""
    print(f"🔍 Scanning folder: {folder_path}")
    
    # Get image files
    try:
        image_files = get_images_from_folder(folder_path)
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        return None
    
    if len(image_files) < 2:
        print(f"❌ Error: Need at least 2 images, found {len(image_files)}")
        return None
    
    print(f"📸 Found {len(image_files)} images:")
    for img in image_files[:10]:  # Show first 10
        print(f"   - {img.name}")
    if len(image_files) > 10:
        print(f"   ... and {len(image_files) - 10} more")
    
    # Prepare files for upload
    files = []
    try:
        for img_path in image_files:
            files.append(('images', (img_path.name, open(img_path, 'rb'), 'image/jpeg')))
        
        data = {'mode': mode}
        
        print(f"\n🚀 Uploading to {API_BASE}/stitch...")
        print(f"📊 Mode: {mode}")
        print(f"📦 Total size: {sum(f.stat().st_size for f in image_files) / (1024*1024):.1f}MB")
        
        # Upload
        response = requests.post(f"{API_BASE}/stitch", files=files, data=data)
        
        if response.status_code == 202:
            result = response.json()
            print(f"✅ Upload successful!")
            print(f"🆔 Job ID: {result['job_id']}")
            print(f"📷 Images uploaded: {result['images_count']}")
            return result['job_id']
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None
    finally:
        # Close all file handles
        for _, (_, file_obj, _) in files:
            file_obj.close()

def check_job_status(job_id):
    """Check job status and progress"""
    try:
        response = requests.get(f"{API_BASE}/status/{job_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"❌ Status check failed: {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Status error: {e}")
        return None

def download_result(job_id, output_path=None):
    """Download panorama result"""
    if not output_path:
        output_path = f"panorama_{job_id}.jpg"
    
    try:
        print(f"📥 Downloading result...")
        response = requests.get(f"{API_BASE}/download/{job_id}", stream=True)
        
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            file_size = os.path.getsize(output_path)
            print(f"✅ Downloaded: {output_path}")
            print(f"📊 File size: {file_size / (1024*1024):.1f}MB")
            return output_path
        else:
            print(f"❌ Download failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Download error: {e}")
        return None

def wait_for_completion(job_id, max_wait=600):
    """Wait for job completion with progress updates"""
    print(f"\n⏳ Processing panorama...")
    start_time = time.time()
    
    while time.time() - start_time < max_wait:
        status = check_job_status(job_id)
        if not status:
            time.sleep(5)
            continue
        
        progress = status.get('progress', 0)
        job_status = status.get('status', 'unknown')
        
        # Progress bar
        bar_length = 30
        filled_length = int(bar_length * progress // 100)
        bar = '█' * filled_length + '░' * (bar_length - filled_length)
        
        print(f"\r📊 Progress: [{bar}] {progress}% ({job_status})", end='', flush=True)
        
        if job_status == 'completed':
            elapsed = time.time() - start_time
            print(f"\n✅ Completed in {elapsed:.1f} seconds!")
            
            if 'processing_time' in status:
                print(f"🔧 Processing time: {status['processing_time']:.1f}s")
            if 'file_size' in status:
                print(f"📊 Output size: {status['file_size'] / (1024*1024):.1f}MB")
            
            return True
            
        elif job_status == 'failed':
            print(f"\n❌ Processing failed!")
            if 'error' in status:
                print(f"Error: {status['error']}")
            return False
            
        time.sleep(2)
    
    print(f"\n⏰ Timeout after {max_wait}s")
    return False

def test_health():
    """Test API health"""
    try:
        response = requests.get(f"{API_BASE}/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ API Health: {health['status']}")
            print(f"🔧 OpenCV Version: {health.get('opencv_version', 'Unknown')}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def main():
    print("🌄 Panorama Backend Folder Test")
    print("=" * 50)
    
    # Check arguments
    if len(sys.argv) < 2:
        print("Usage: python test_folder.py <folder_path> [mode]")
        print("Modes: auto (default), scans")
        print("\nExample:")
        print("  python test_folder.py ./my_photos")
        print("  python test_folder.py ./my_photos auto")
        sys.exit(1)
    
    folder_path = sys.argv[1]
    mode = sys.argv[2] if len(sys.argv) > 2 else 'auto'
    
    # Test API health
    print("🔍 Testing API connection...")
    if not test_health():
        print("❌ API not available. Make sure backend is running on localhost:5000")
        sys.exit(1)
    
    # Upload folder
    job_id = upload_folder(folder_path, mode)
    if not job_id:
        sys.exit(1)
    
    # Wait for completion
    success = wait_for_completion(job_id)
    if not success:
        sys.exit(1)
    
    # Download result
    output_file = download_result(job_id)
    if output_file:
        print(f"\n🎉 Success! Panorama saved as: {output_file}")
        
        # Show final status
        final_status = check_job_status(job_id)
        if final_status and 'processing_time' in final_status:
            print(f"⚡ Total processing time: {final_status['processing_time']:.1f}s")
    else:
        print("\n❌ Failed to download result")
        sys.exit(1)

if __name__ == "__main__":
    main()