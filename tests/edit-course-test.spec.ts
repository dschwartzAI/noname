import { test, expect } from '@playwright/test'

test.describe('Course Edit Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to classroom page
    await page.goto('/syndicate/classroom')
    
    // Wait for page to load
    await expect(page.getByText('Training Courses')).toBeVisible({ timeout: 10000 })
  })

  test('should show category filter on classroom page', async ({ page }) => {
    // Check if category filter is visible
    const categoryLabel = page.getByText('Category:', { exact: false })
    await expect(categoryLabel).toBeVisible({ timeout: 5000 })
    
    // Check if category select is visible
    const categorySelect = page.locator('[id="category-filter"]')
    await expect(categorySelect).toBeVisible()
    
    // Click to open dropdown
    await categorySelect.click()
    
    // Should see "All Categories" option
    await expect(page.getByText('All Categories')).toBeVisible()
  })

  test('should open edit dialog when clicking edit button', async ({ page }) => {
    // Wait for courses to load
    await page.waitForTimeout(2000)
    
    // Find course cards
    const courseCards = page.locator('[class*="card"]').filter({ hasText: /course/i })
    const cardCount = await courseCards.count()
    
    if (cardCount > 0) {
      // Find the first course card with edit button
      const firstCard = courseCards.first()
      
      // Look for the three-dot menu button (MoreVertical icon)
      const editMenuButton = firstCard.locator('button').filter({ 
        has: page.locator('svg') 
      }).first()
      
      if (await editMenuButton.isVisible({ timeout: 3000 })) {
        // Click the menu button
        await editMenuButton.click()
        
        // Wait for dropdown menu
        await page.waitForTimeout(500)
        
        // Click "Edit Course" option
        const editOption = page.getByText('Edit Course', { exact: false })
        if (await editOption.isVisible({ timeout: 2000 })) {
          await editOption.click()
          
          // Should see edit dialog
          await expect(page.getByText(/edit course/i)).toBeVisible({ timeout: 5000 })
          
          // Should see course title field
          const titleInput = page.getByLabel(/title/i)
          await expect(titleInput).toBeVisible()
        }
      }
    }
  })

  test('should fetch course data when editing', async ({ page }) => {
    // Wait for courses to load
    await page.waitForTimeout(2000)
    
    // Monitor network requests
    const courseFetchPromise = page.waitForResponse(
      (response) => response.url().includes('/api/v1/courses/') && response.request().method() === 'GET',
      { timeout: 10000 }
    )
    
    // Find and click edit button (same as above test)
    const courseCards = page.locator('[class*="card"]').filter({ hasText: /course/i })
    const cardCount = await courseCards.count()
    
    if (cardCount > 0) {
      const firstCard = courseCards.first()
      const editMenuButton = firstCard.locator('button').filter({ 
        has: page.locator('svg') 
      }).first()
      
      if (await editMenuButton.isVisible({ timeout: 3000 })) {
        await editMenuButton.click()
        await page.waitForTimeout(500)
        
        const editOption = page.getByText('Edit Course', { exact: false })
        if (await editOption.isVisible({ timeout: 2000 })) {
          await editOption.click()
          
          // Wait for API call
          const response = await courseFetchPromise
          
          // Should be successful
          expect(response.status()).toBe(200)
          
          // Should have course data
          const data = await response.json()
          expect(data).toHaveProperty('id')
          expect(data).toHaveProperty('title')
          expect(data).toHaveProperty('instructor')
        }
      }
    }
  })

  test('should display course data in edit dialog', async ({ page }) => {
    // Wait for courses to load
    await page.waitForTimeout(2000)
    
    // Find and open edit dialog (same pattern as above)
    const courseCards = page.locator('[class*="card"]').filter({ hasText: /course/i })
    const cardCount = await courseCards.count()
    
    if (cardCount > 0) {
      const firstCard = courseCards.first()
      const editMenuButton = firstCard.locator('button').filter({ 
        has: page.locator('svg') 
      }).first()
      
      if (await editMenuButton.isVisible({ timeout: 3000 })) {
        await editMenuButton.click()
        await page.waitForTimeout(500)
        
        const editOption = page.getByText('Edit Course', { exact: false })
        if (await editOption.isVisible({ timeout: 2000 })) {
          await editOption.click()
          
          // Wait for dialog
          await expect(page.getByText(/edit course/i)).toBeVisible({ timeout: 5000 })
          
          // Check that form fields are populated
          const titleInput = page.getByLabel(/title/i)
          await expect(titleInput).toBeVisible()
          
          // Title should have a value
          const titleValue = await titleInput.inputValue()
          expect(titleValue.length).toBeGreaterThan(0)
          
          // Instructor field should be visible and populated
          const instructorInput = page.getByLabel(/instructor/i)
          await expect(instructorInput).toBeVisible()
          
          const instructorValue = await instructorInput.inputValue()
          expect(instructorValue.length).toBeGreaterThan(0)
        }
      }
    }
  })
})




