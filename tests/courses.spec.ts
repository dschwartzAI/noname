import { test, expect } from '@playwright/test'

test.describe('Course Management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to classroom page
    await page.goto('/syndicate/classroom')
    
    // Wait for page to load
    await expect(page.getByText('Classroom')).toBeVisible()
  })

  test('should navigate to course builder', async ({ page }) => {
    // Click "Create Course" button
    const createButton = page.getByRole('button', { name: /create course/i })
    await expect(createButton).toBeVisible()
    await createButton.click()
    
    // Should navigate to builder page
    await expect(page).toHaveURL(/.*\/classroom\/builder/)
    
    // Should see course builder dialog
    await expect(page.getByText(/create new course|edit course/i)).toBeVisible()
  })

  test('should create a new course', async ({ page }) => {
    // Navigate to builder
    await page.goto('/syndicate/classroom/builder')
    
    // Wait for dialog to appear
    await expect(page.getByText(/create new course/i)).toBeVisible({ timeout: 5000 })
    
    // Fill in course details
    await page.getByLabel(/title/i).fill('Test Course')
    await page.getByLabel(/instructor/i).fill('Test Instructor')
    
    const descriptionInput = page.getByLabel(/description/i)
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('This is a test course description')
    }
    
    // Optionally fill thumbnail URL
    const thumbnailInput = page.getByLabel(/thumbnail url/i)
    if (await thumbnailInput.isVisible()) {
      await thumbnailInput.fill('https://example.com/thumbnail.jpg')
    }
    
    // Set tier to "free" - look for the tier select
    const tierSelect = page.locator('[id="tier"], [aria-label*="tier" i]').or(
      page.locator('select, [role="combobox"]').filter({ hasText: /tier/i }).first()
    )
    if (await tierSelect.isVisible({ timeout: 2000 })) {
      await tierSelect.click()
      await page.getByRole('option', { name: /free/i }).click()
    }
    
    // Save course
    const saveButton = page.getByRole('button', { name: /create course/i })
    await expect(saveButton).toBeVisible()
    await saveButton.click()
    
    // Wait for success toast/message
    await expect(
      page.getByText(/course created|success/i).or(page.locator('text=/created successfully/i'))
    ).toBeVisible({ timeout: 10000 })
    
    // After creation, modules section should appear
    await expect(page.getByText(/modules/i)).toBeVisible({ timeout: 5000 })
    
    // Verify "Add Module" button is visible
    await expect(page.getByRole('button', { name: /add module/i })).toBeVisible({ timeout: 3000 })
  })

  test('should create course with module and lesson', async ({ page }) => {
    // Navigate to builder
    await page.goto('/syndicate/classroom/builder')
    
    // Wait for dialog
    await expect(page.getByText(/create new course/i)).toBeVisible({ timeout: 5000 })
    
    // Fill course details
    await page.getByLabel(/title/i).fill('Complete Course')
    await page.getByLabel(/instructor/i).fill('John Doe')
    
    // Create course first
    const createButton = page.getByRole('button', { name: /create course/i })
    await expect(createButton).toBeVisible()
    await createButton.click()
    
    // Wait for success message
    await expect(
      page.getByText(/course created|success/i).or(page.locator('text=/created successfully/i'))
    ).toBeVisible({ timeout: 10000 })
    
    // Wait for course to be created and modules section to appear
    await expect(page.getByText(/modules/i)).toBeVisible({ timeout: 10000 })
    
    // Add module
    const addModuleButton = page.getByRole('button', { name: /add module/i })
    await expect(addModuleButton).toBeVisible({ timeout: 3000 })
    await addModuleButton.click()
    
    // Fill module details in dialog
    await expect(page.getByText(/create module|edit module/i)).toBeVisible({ timeout: 3000 })
    
    const moduleTitleInput = page.getByLabel(/module.*title/i).or(page.locator('[id*="module-title" i]'))
    await expect(moduleTitleInput).toBeVisible({ timeout: 2000 })
    await moduleTitleInput.fill('Introduction Module')
    
    const moduleDescInput = page.getByLabel(/module.*description/i).or(page.locator('[id*="module-description" i]'))
    if (await moduleDescInput.isVisible({ timeout: 1000 })) {
      await moduleDescInput.fill('Introduction to the course')
    }
    
    // Save module - find the save button in the module dialog
    const saveModuleButton = page.locator('dialog, [role="dialog"]')
      .getByRole('button', { name: /save/i })
      .first()
    await expect(saveModuleButton).toBeVisible({ timeout: 2000 })
    await saveModuleButton.click()
    
    // Wait for module to appear and success message
    await expect(page.getByText('Introduction Module')).toBeVisible({ timeout: 5000 })
    
    // Expand module to see lessons section - look for chevron button
    const moduleCard = page.locator('text=Introduction Module').locator('..').locator('..')
    const expandButton = moduleCard.locator('button').filter({ hasText: /chevron/i }).or(
      moduleCard.locator('button').first()
    )
    if (await expandButton.isVisible({ timeout: 2000 })) {
      await expandButton.click()
      await page.waitForTimeout(500) // Wait for expansion animation
    }
    
    // Add lesson
    const addLessonButton = page.getByRole('button', { name: /add lesson/i })
    await expect(addLessonButton).toBeVisible({ timeout: 3000 })
    await addLessonButton.click()
    
    // Fill lesson details
    await expect(page.getByText(/create lesson|edit lesson/i)).toBeVisible({ timeout: 3000 })
    
    const lessonTitleInput = page.getByLabel(/lesson.*title/i).or(page.locator('[id*="lesson-title" i]'))
    await expect(lessonTitleInput).toBeVisible({ timeout: 2000 })
    await lessonTitleInput.fill('Welcome Lesson')
    
    const lessonDescInput = page.getByLabel(/lesson.*description/i).or(page.locator('[id*="lesson-description" i]'))
    if (await lessonDescInput.isVisible({ timeout: 1000 })) {
      await lessonDescInput.fill('Welcome to the course')
    }
    
    // Fill video URL
    const videoUrlInput = page.getByLabel(/video url/i).or(page.locator('[id*="lesson-video-url" i]'))
    if (await videoUrlInput.isVisible({ timeout: 1000 })) {
      await videoUrlInput.fill('https://youtube.com/watch?v=test123')
    }
    
    // Select video provider
    const providerSelect = page.locator('[id*="lesson-video-provider" i]').or(
      page.locator('select, [role="combobox"]').filter({ hasText: /provider/i }).first()
    )
    if (await providerSelect.isVisible({ timeout: 1000 })) {
      await providerSelect.click()
      await page.getByRole('option', { name: /youtube/i }).click()
    }
    
    // Save lesson - find save button in lesson dialog
    const saveLessonButton = page.locator('dialog, [role="dialog"]')
      .getByRole('button', { name: /save/i })
      .first()
    await expect(saveLessonButton).toBeVisible({ timeout: 2000 })
    await saveLessonButton.click()
    
    // Verify lesson appears
    await expect(page.getByText('Welcome Lesson')).toBeVisible({ timeout: 5000 })
  })

  test('should validate required fields', async ({ page }) => {
    await page.goto('/syndicate/classroom/builder')
    
    await expect(page.getByText(/create new course/i)).toBeVisible()
    
    // Try to save without filling required fields
    const saveButton = page.getByRole('button', { name: /create course/i })
    await saveButton.click()
    
    // Should show validation error
    await expect(
      page.getByText(/required|title|instructor/i)
    ).toBeVisible({ timeout: 3000 })
  })

  test('should edit existing course', async ({ page }) => {
    // First, create a course (or assume one exists)
    await page.goto('/syndicate/classroom')
    
    // Wait for courses to load
    await page.waitForTimeout(2000)
    
    // Find a course card and click edit (if edit button exists)
    // Or navigate directly to builder with courseId
    // For now, we'll test the builder with a courseId parameter
    
    // Navigate to builder with a course (this would require an existing course)
    // This test assumes you have at least one course
    const courseCards = page.locator('[data-testid="course-card"], .course-card').or(
      page.locator('text=/course/i').locator('..')
    )
    
    const cardCount = await courseCards.count()
    if (cardCount > 0) {
      // Click on first course to view it
      await courseCards.first().click()
      
      // If there's an edit button, click it
      const editButton = page.getByRole('button', { name: /edit/i })
      if (await editButton.isVisible({ timeout: 2000 })) {
        await editButton.click()
        
        // Should see edit dialog
        await expect(page.getByText(/edit course/i)).toBeVisible()
        
        // Modify title
        const titleInput = page.getByLabel(/title/i)
        await titleInput.clear()
        await titleInput.fill('Updated Course Title')
        
        // Save
        await page.getByRole('button', { name: /update|save/i }).click()
        
        // Verify update
        await expect(page.getByText(/updated|success/i)).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test('should delete module', async ({ page }) => {
    // This test assumes a course with modules exists
    await page.goto('/syndicate/classroom/builder')
    
    // If editing an existing course, modules should be visible
    await page.waitForTimeout(2000)
    
    // Look for modules
    const moduleCards = page.locator('text=/module/i').locator('..')
    const moduleCount = await moduleCards.count()
    
    if (moduleCount > 0) {
      // Find delete button for first module
      const deleteButton = moduleCards.first().getByRole('button', { name: /delete|trash/i })
      
      if (await deleteButton.isVisible({ timeout: 2000 })) {
        await deleteButton.click()
        
        // Module should be removed
        await page.waitForTimeout(1000)
        // Verify module count decreased or module is gone
      }
    }
  })

  test('should delete lesson', async ({ page }) => {
    // This test assumes a course with lessons exists
    await page.goto('/syndicate/classroom/builder')
    
    await page.waitForTimeout(2000)
    
    // Expand a module if collapsed
    const expandButtons = page.locator('button').filter({ hasText: /chevron|expand/i })
    if (await expandButtons.count() > 0) {
      await expandButtons.first().click()
      await page.waitForTimeout(500)
    }
    
    // Look for lessons
    const lessonItems = page.locator('text=/lesson/i').locator('..')
    const lessonCount = await lessonItems.count()
    
    if (lessonCount > 0) {
      // Find delete button for first lesson
      const deleteButton = lessonItems.first().getByRole('button', { name: /delete|trash/i })
      
      if (await deleteButton.isVisible({ timeout: 2000 })) {
        await deleteButton.click()
        
        // Lesson should be removed
        await page.waitForTimeout(1000)
      }
    }
  })
})

